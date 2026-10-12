/**
 * P4 platform features: API keys, tracking pixels, tracked short links.
 */
import { createHash, randomBytes } from "node:crypto";
import { getRequestHeader, type H3Event } from "h3";
import type { EngineConfig } from "./config";
import { collectRange, getDoc, putDoc } from "./couch";
import { getDailySalt, visitorHash } from "./identity";
import { buildRawEvent } from "./hit";
import { geoFromHeaders, getClientIp, ipMatchesCidrs } from "./net";
import { enqueueRawEvent } from "./queue";
import { getSite } from "./sites";
import { mainDb } from "./storage";
import { localDay } from "./time";
import type { SiteDoc } from "./types";
import { isBot, parseUserAgent } from "./ua";

// ---------------------------------------------------------------- API keys

export interface ApiKeyDoc {
  _id: string;
  _rev?: string;
  type: "apikey";
  name: string;
  prefix: string;
  createdAt: string;
  createdBy: string | null;
  lastUsedAt?: string | null;
}

export const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

/** Creates a key; the plaintext is returned once and never stored. */
export const createApiKey = async (config: EngineConfig, name: string, createdBy: string | null) => {
  const key = `cfa_${randomBytes(30).toString("base64url")}`;
  const doc: ApiKeyDoc = {
    _id: `apikey:${hashKey(key)}`,
    type: "apikey",
    name: name.slice(0, 100) || "API key",
    prefix: key.slice(0, 10),
    createdAt: new Date().toISOString(),
    createdBy,
  };
  await putDoc(mainDb(config), doc);
  const { _rev, ...rest } = doc;
  return { key, apiKey: { ...rest, id: doc._id.slice(7) } };
};

export const listApiKeys = async (config: EngineConfig) =>
  (await collectRange<ApiKeyDoc>(mainDb(config), "apikey:", "apikey:￰")).map(({ _rev, ...doc }) => ({ ...doc, id: doc._id.slice(7) }));

const lastUsedWrites = new Map<string, number>();

/** Resolves a bearer key; updates `lastUsedAt` at most hourly. */
export const verifyApiKey = async (config: EngineConfig, key: string | null): Promise<ApiKeyDoc | null> => {
  if (!key || !key.startsWith("cfa_") || key.length < 20) return null;
  const id = `apikey:${hashKey(key)}`;
  const doc = await getDoc<ApiKeyDoc>(mainDb(config), id);
  if (!doc) return null;
  const now = Date.now();
  if (now - (lastUsedWrites.get(id) ?? 0) > 3600_000) {
    lastUsedWrites.set(id, now);
    void putDoc(mainDb(config), { ...doc, lastUsedAt: new Date(now).toISOString() }).catch(() => undefined);
  }
  return doc;
};

export const bearerToken = (event: H3Event): string | null => {
  const header = getRequestHeader(event, "authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
};

// ------------------------------------------------------ pixels & links

export interface PixelDoc {
  _id: string;
  _rev?: string;
  type: "pixel";
  site: string;
  name: string;
  createdAt: string;
}

export interface LinkDoc {
  _id: string;
  _rev?: string;
  type: "link";
  site: string;
  slug: string;
  url: string;
  name: string;
  createdAt: string;
}

export const SLUG_PATTERN = /^[A-Za-z0-9_-]{2,64}$/;

export const createPixel = async (config: EngineConfig, site: SiteDoc, name: string) => {
  const token = randomBytes(12).toString("base64url");
  const doc: PixelDoc = { _id: `pixel:${token}`, type: "pixel", site: site.id, name: name.slice(0, 100) || "pixel", createdAt: new Date().toISOString() };
  await putDoc(mainDb(config), doc);
  return { ...doc, token };
};

export const createLink = async (config: EngineConfig, site: SiteDoc, input: { slug?: string; url?: string; name?: string }) => {
  const slug = (input.slug || randomBytes(5).toString("base64url")).trim();
  if (!SLUG_PATTERN.test(slug)) throw new Error("Invalid slug (2-64 chars of A-Z, a-z, 0-9, - or _)");
  let url: URL;
  try {
    url = new URL(String(input.url ?? ""));
  } catch {
    throw new Error("Invalid destination URL");
  }
  if (!/^https?:$/.test(url.protocol)) throw new Error("Invalid destination URL (http/https only)");
  if (await getDoc(mainDb(config), `link:${slug}`)) throw new Error(`Invalid slug: "${slug}" is taken`);
  const doc: LinkDoc = { _id: `link:${slug}`, type: "link", site: site.id, slug, url: url.toString(), name: (input.name ?? slug).slice(0, 100), createdAt: new Date().toISOString() };
  await putDoc(mainDb(config), doc);
  return doc;
};

/**
 * Records a server-observed hit (pixel load / link click) through the normal
 * pipeline (bot, IP and site rules apply; DNT is honoured).
 */
export const recordServerHit = async (
  event: H3Event,
  config: EngineConfig,
  siteId: string,
  payload: { url: string; name: string; data: Record<string, string> },
) => {
  const site = await getSite(config, siteId);
  if (!site?.enabled) return false;
  const ua = getRequestHeader(event, "user-agent") || "";
  if (isBot(ua)) return false;
  if (config.respectDnt && (getRequestHeader(event, "dnt") === "1" || getRequestHeader(event, "sec-gpc") === "1")) return false;
  const ip = getClientIp(event);
  if (ipMatchesCidrs(ip, config.ignoreIps)) return false;
  const now = Date.now();
  const salt = await getDailySalt(config, localDay(now, site.timezone));
  const result = buildRawEvent({
    body: {
      type: "event",
      payload: {
        hostname: site.domains[0] ?? "server",
        url: payload.url,
        referrer: getRequestHeader(event, "referer") ?? "",
        language: (getRequestHeader(event, "accept-language") ?? "").split(",")[0]?.split(";")[0],
        name: payload.name,
        data: payload.data,
      },
    },
    site: { ...site, excludedPaths: [] },
    config: { ...config, excludedPaths: [] },
    agent: parseUserAgent(ua),
    geo: config.geoSource === "header" ? geoFromHeaders(event) : { country: null, region: null, city: null },
    visitor: visitorHash(salt, site.id, ip, ua),
    now,
    random: randomBytes(4).toString("hex"),
  });
  if (!result.ok) return false;
  enqueueRawEvent(config, result.doc);
  return true;
};
