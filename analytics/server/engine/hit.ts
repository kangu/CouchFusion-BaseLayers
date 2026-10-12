/**
 * Pure transformation of a tracker payload into a raw event document.
 */
import type { EngineConfig } from "./config";
import { createExclusionMatcher } from "./exclusions";
import type { GeoInfo } from "./net";
import { classifyChannel, hasClickId, parseReferrer, parseUtm } from "./referrer";
import { hostAllowed } from "./sites";
import { rawEventId } from "./storage";
import type { RawEvent, SiteDoc } from "./types";
import type { ParsedUserAgent } from "./ua";

export interface HitContext {
  body: unknown;
  site: SiteDoc;
  config: Pick<EngineConfig, "excludedPaths" | "persistentId">;
  agent: ParsedUserAgent;
  geo: GeoInfo;
  visitor: string;
  now: number;
  random: string;
}

export type HitResult =
  | { ok: true; doc: RawEvent }
  | { ok: false; reason: "invalid" | "host" | "excluded" };

const MAX_DATA_KEYS = 20;

const str = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
};

/** Flattens event data into at most 20 scalar properties. */
export const sanitizeEventData = (value: unknown): Record<string, string | number | boolean> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result: Record<string, string | number | boolean> = {};
  for (const [rawKey, rawValue] of Object.entries(value as Record<string, unknown>)) {
    if (Object.keys(result).length >= MAX_DATA_KEYS) break;
    const key = rawKey.trim().slice(0, 50);
    if (!key) continue;
    if (typeof rawValue === "number") {
      if (Number.isFinite(rawValue)) result[key] = rawValue;
    } else if (typeof rawValue === "boolean") {
      result[key] = rawValue;
    } else if (typeof rawValue === "string") {
      result[key] = rawValue.slice(0, 200);
    } else if (rawValue !== null && rawValue !== undefined) {
      try {
        result[key] = JSON.stringify(rawValue).slice(0, 200);
      } catch {
        // Skip unserializable values.
      }
    }
  }
  return Object.keys(result).length ? result : null;
};

/** Normalizes a path: strips trailing slash (except root) and caps length. */
export const normalizePath = (path: string): string => {
  let normalized = path || "/";
  if (!normalized.startsWith("/")) normalized = `/${normalized}`;
  if (normalized.length > 1) normalized = normalized.replace(/\/+$/, "") || "/";
  return normalized.slice(0, 500);
};

/** Builds the raw document for one tracked hit. */
export const buildRawEvent = (ctx: HitContext): HitResult => {
  const body = ctx.body as Record<string, any> | null;
  if (!body || typeof body !== "object") return { ok: false, reason: "invalid" };
  const type = body.type ?? "event";
  if (type !== "event" && type !== "identify") return { ok: false, reason: "invalid" };
  const payload = body.payload;
  if (!payload || typeof payload !== "object") return { ok: false, reason: "invalid" };

  const hostname = str(payload.hostname, 253)?.toLowerCase() ?? ctx.site.domains[0] ?? "unknown";
  if (!hostAllowed(ctx.site, hostname)) return { ok: false, reason: "host" };

  const rawUrl = str(payload.url, 2000) ?? str(payload.pathname, 2000) ?? "/";
  let url: URL;
  try {
    url = new URL(rawUrl, `https://${hostname}`);
  } catch {
    return { ok: false, reason: "invalid" };
  }

  const path = normalizePath(url.pathname);
  const isExcluded = createExclusionMatcher([...ctx.site.excludedPaths, ...ctx.config.excludedPaths]);
  if (isExcluded(path) || isExcluded(url.pathname)) return { ok: false, reason: "excluded" };

  const name = str(payload.name, 100);
  const t: RawEvent["t"] = type === "identify" ? "id" : name ? "ev" : "pv";

  const referrer = parseReferrer(payload.referrer, [hostname, ...ctx.site.domains]);
  const utm = parseUtm(url.searchParams);
  const channel = classifyChannel(referrer, utm, hasClickId(url.searchParams));
  const hasUtm = Object.values(utm).some(Boolean);

  const screen = str(payload.screen, 11);
  const language = str(payload.language, 35);
  const pid = ctx.config.persistentId ? str(payload.pid, 64) : null;
  const uid = str(payload.id, 100);

  const doc: RawEvent = {
    _id: rawEventId(ctx.site.id, ctx.now, ctx.random),
    t,
    ts: ctx.now,
    v: ctx.visitor,
    p: path,
    h: hostname.replace(/^www\./, ""),
    ch: channel,
    br: ctx.agent.browser,
    os: ctx.agent.os,
    dv: ctx.agent.device,
  };
  if (ctx.site.keepQuery && url.search) doc.q = url.search.slice(0, 500);
  if (ctx.site.keepHash && url.hash) doc.p = normalizePath(`${path}${url.hash}`.slice(0, 500));
  const title = str(payload.title, 200);
  if (title) doc.ti = title;
  if (referrer) {
    doc.r = referrer.name;
    doc.rd = referrer.domain;
    doc.rp = referrer.path;
  }
  if (hasUtm) doc.utm = utm;
  if (screen && /^\d{2,5}x\d{2,5}$/.test(screen)) doc.sc = screen;
  if (language && /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{1,8})*$/.test(language)) doc.lg = language.toLowerCase();
  if (ctx.geo.country) doc.cc = ctx.geo.country;
  if (ctx.geo.region) doc.rg = ctx.geo.region;
  if (ctx.geo.city) doc.ci = ctx.geo.city;
  if (t === "ev") doc.n = name;
  const data = sanitizeEventData(payload.data);
  if (data && t !== "pv") doc.d = data;
  const tag = str(payload.tag, 50);
  if (tag) doc.tg = tag;
  if (uid) doc.uid = uid;
  if (pid && /^[A-Za-z0-9_-]{8,64}$/.test(pid)) doc.pid = pid;
  return { ok: true, doc };
};
