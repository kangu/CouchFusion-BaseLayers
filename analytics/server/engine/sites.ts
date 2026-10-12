/**
 * Website registry stored as `site:<id>` docs in the main analytics database.
 */
import { randomBytes } from "node:crypto";
import type { EngineConfig } from "./config";
import { CouchError, ensureDatabase, getDoc, putDoc } from "./couch";
import { normalizeHost } from "./referrer";
import { mainDb } from "./storage";
import { isValidTimeZone } from "./time";
import type { SiteDoc, SiteGoal } from "./types";

export const SITE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,47}$/;

const CACHE_TTL_MS = 30_000;
let cache: { db: string; expiresAt: number; sites: SiteDoc[] } | null = null;

const stringList = (value: unknown, max = 100, length = 200): string[] =>
  (Array.isArray(value) ? value : typeof value === "string" ? value.split(/[\n,]/) : [])
    .map((entry) => String(entry).trim())
    .filter(Boolean)
    .slice(0, max)
    .map((entry) => entry.slice(0, length));

const sanitizeGoals = (value: unknown): SiteGoal[] =>
  (Array.isArray(value) ? value : [])
    .filter((goal) => goal && typeof goal === "object")
    .slice(0, 50)
    .map((goal: any, index) => ({
      id: typeof goal.id === "string" && goal.id ? goal.id.slice(0, 40) : `g${Date.now().toString(36)}${index}`,
      name: String(goal.name ?? goal.value ?? "Goal").slice(0, 100),
      type: goal.type === "event" ? "event" : "path",
      value: String(goal.value ?? "").slice(0, 200),
    }))
    .filter((goal) => goal.value);

/**
 * Normalizes user input into a site doc. `existing` supplies immutable fields.
 * Throws on invalid id / timezone.
 */
export const sanitizeSite = (input: Record<string, any>, existing?: SiteDoc | null): SiteDoc => {
  const id = existing?.id ?? String(input.id ?? "").trim().toLowerCase();
  if (!SITE_ID_PATTERN.test(id)) {
    throw new Error("Site id must be 1-48 chars of a-z, 0-9, '-' or '_'");
  }
  const timezone = String(input.timezone ?? existing?.timezone ?? "UTC");
  if (!isValidTimeZone(timezone)) throw new Error(`Invalid timezone: ${timezone}`);
  const now = new Date().toISOString();
  const pick = <K extends keyof SiteDoc>(key: K, fallback: SiteDoc[K]): SiteDoc[K] =>
    (input[key as string] !== undefined ? input[key as string] : existing?.[key] ?? fallback) as SiteDoc[K];

  return {
    _id: `site:${id}`,
    ...(existing?._rev ? { _rev: existing._rev } : {}),
    type: "site",
    id,
    name: String(pick("name", id)).trim().slice(0, 100) || id,
    domains: stringList(pick("domains", [])).map(normalizeHost),
    timezone,
    excludedPaths: stringList(pick("excludedPaths", [])),
    keepQuery: Boolean(pick("keepQuery", false)),
    keepHash: Boolean(pick("keepHash", false)),
    enabled: pick("enabled", true) !== false,
    shareToken: existing?.shareToken ?? null,
    allowedRoles: stringList(pick("allowedRoles", []), 20, 60),
    goals: sanitizeGoals(pick("goals", [])),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
};

/**
 * Each app tracks exactly one website (`config.defaultSiteId`). The list form
 * is kept so callers can iterate, but it holds at most that one site.
 * Cached for 30 s.
 */
export const listSites = async (config: EngineConfig, { fresh = false } = {}): Promise<SiteDoc[]> => {
  const key = `${mainDb(config)}:${config.defaultSiteId}`;
  if (!fresh && cache && cache.db === key && Date.now() < cache.expiresAt) return cache.sites;
  const site = await getDoc<SiteDoc>(mainDb(config), `site:${config.defaultSiteId}`);
  const sites = site ? [site] : [];
  cache = { db: key, expiresAt: Date.now() + CACHE_TTL_MS, sites };
  return sites;
};

const serverTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

let ensuring: Promise<SiteDoc> | null = null;

/**
 * Returns the app's website, creating it with sensible defaults on first use
 * (any hostname accepted, `/admin*` and `/login` excluded, server timezone).
 */
export const ensureAppSite = async (config: EngineConfig, { fresh = false } = {}): Promise<SiteDoc> => {
  const existing = (await listSites(config, { fresh }))[0];
  if (existing) return existing;
  if (ensuring) return ensuring;
  ensuring = (async () => {
    const db = mainDb(config);
    await ensureDatabase(db);
    const site = sanitizeSite({
      id: config.defaultSiteId,
      name: config.slug || config.defaultSiteId,
      timezone: serverTimeZone(),
      excludedPaths: ["/admin*", "/login"],
    });
    try {
      await putDoc(db, site);
    } catch (error) {
      if (!(error instanceof CouchError && error.status === 409)) throw error;
    }
    invalidateSites();
    const created = (await listSites(config, { fresh: true }))[0];
    if (!created) throw new Error("Unable to create the analytics website document");
    return created;
  })();
  try {
    return await ensuring;
  } finally {
    ensuring = null;
  }
};

/** Resolves the app's website by id; any other id is unknown. */
export const getSite = async (config: EngineConfig, id: string, { fresh = false } = {}) =>
  (await listSites(config, { fresh })).find((site) => site.id === id) ?? null;

export const invalidateSites = (): void => {
  cache = null;
};

/** Creates or updates a site. */
export const saveSite = async (config: EngineConfig, site: SiteDoc): Promise<SiteDoc> => {
  const result = await putDoc(mainDb(config), site);
  invalidateSites();
  return { ...site, _rev: result?.rev };
};

/** Rotates (or revokes, with `enabled=false`) the public share token. */
export const setShareToken = async (config: EngineConfig, site: SiteDoc, enabled: boolean) => {
  const next: SiteDoc = {
    ...site,
    shareToken: enabled ? randomBytes(24).toString("base64url") : null,
    updatedAt: new Date().toISOString(),
  };
  return saveSite(config, next);
};

export const findSiteByShareToken = async (config: EngineConfig, token: string) => {
  if (!token || token.length < 16) return null;
  return (await listSites(config)).find((site) => site.shareToken === token) ?? null;
};

/** True when `hostname` is allowed for the site (empty domain list allows any). */
export const hostAllowed = (site: SiteDoc, hostname: string): boolean => {
  if (!site.domains.length) return true;
  const host = normalizeHost(hostname);
  if (host === "localhost" || host === "127.0.0.1") return true;
  return site.domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
};
