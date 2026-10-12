/**
 * Self-hosted ingestion: resolves the site, applies privacy/bot/IP rules,
 * enriches the hit, and queues it for storage.
 */
import { randomBytes } from "node:crypto";
import { getRequestHeader, type H3Event } from "h3";
import type { EngineConfig } from "./config";
import { buildRawEvent } from "./hit";
import { geoFromHeaders, getClientIp, ipMatchesCidrs } from "./net";
import { getDailySalt, visitorHash } from "./identity";
import { enqueueRawEvent } from "./queue";
import { ensureAppSite } from "./sites";
import { localDay } from "./time";
import type { SiteDoc } from "./types";
import { isBot, parseUserAgent } from "./ua";

export type CollectOutcome =
  | "stored"
  | "invalid"
  | "disabled"
  | "host"
  | "excluded"
  | "bot"
  | "dnt"
  | "ignored_ip"
  | "rate_limited";

/** In-memory counters since process start, shown in Settings to verify CDN geo headers. */
export const geoStats = { stored: 0, withCountry: 0, since: Date.now() };

/** How many hits ended in each outcome since process start (why hits are dropped). */
export const outcomeStats: Partial<Record<CollectOutcome, number>> = {};

const RATE_WINDOW_MS = 10_000;
const RATE_LIMIT = 30;
const rateBuckets = new Map<string, { start: number; count: number }>();

/** Fixed-window limiter keyed by visitor hash. */
export const isRateLimited = (key: string, now = Date.now()): boolean => {
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.start >= RATE_WINDOW_MS) {
    rateBuckets.set(key, { start: now, count: 1 });
    if (rateBuckets.size > 50_000) {
      for (const [k, b] of rateBuckets) if (now - b.start >= RATE_WINDOW_MS) rateBuckets.delete(k);
    }
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT;
};

/**
 * Every hit belongs to the app's single website. A client-supplied
 * `payload.website` is ignored.
 */
export const resolveTargetSite = (config: EngineConfig): Promise<SiteDoc> => ensureAppSite(config);

const runPipeline = async (
  event: H3Event,
  body: unknown,
  config: EngineConfig,
  now = Date.now(),
): Promise<CollectOutcome> => {
  const payload = (body as any)?.payload;
  if (!payload || typeof payload !== "object") return "invalid";

  const userAgent = getRequestHeader(event, "user-agent") || "";
  if (isBot(userAgent)) return "bot";
  if (
    config.respectDnt &&
    (getRequestHeader(event, "dnt") === "1" || getRequestHeader(event, "sec-gpc") === "1")
  ) {
    return "dnt";
  }
  const ip = getClientIp(event);
  if (ipMatchesCidrs(ip, config.ignoreIps)) return "ignored_ip";

  const site = await resolveTargetSite(config);
  if (!site.enabled) return "disabled";

  const salt = await getDailySalt(config, localDay(now, site.timezone));
  const visitor = visitorHash(salt, site.id, ip, userAgent);
  if (isRateLimited(`${site.id}:${visitor}`, now)) return "rate_limited";

  const result = buildRawEvent({
    body,
    site,
    config,
    agent: parseUserAgent(userAgent),
    geo: config.geoSource === "header" ? geoFromHeaders(event) : { country: null, region: null, city: null },
    visitor,
    now,
    random: randomBytes(4).toString("hex"),
  });
  if (!result.ok) return result.reason;
  enqueueRawEvent(config, result.doc);
  geoStats.stored += 1;
  if (result.doc.cc) geoStats.withCountry += 1;
  return "stored";
};

/** Runs the ingestion pipeline for one request body and counts its outcome. */
export const collectHit = async (
  event: H3Event,
  body: unknown,
  config: EngineConfig,
  now = Date.now(),
): Promise<CollectOutcome> => {
  const outcome = await runPipeline(event, body, config, now);
  outcomeStats[outcome] = (outcomeStats[outcome] ?? 0) + 1;
  return outcome;
};
