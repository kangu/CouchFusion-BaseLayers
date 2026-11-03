/**
 * Engine settings resolved from the app's CouchDB `_config` section
 * `cf_env_[appSlug]` (flat key/values). Every key is optional: with none set,
 * analytics runs on defaults. Cached briefly so admin edits apply without a restart.
 *
 * A failed read never silently turns into defaults: the last settings that
 * loaded keep being used, and before any have loaded the config is marked
 * `loaded: false` so nothing writes, provisions or deletes data with guesses.
 */
import {
  buildCouchEnvSection,
  normalizeCouchEnvSlug,
  parseCouchConfigString,
  resolveRuntimeAppSlug,
} from "#database/utils/couch-config";
import { couch, CouchError } from "./couch";
import type { GeoSource } from "./geo";
import { parseCidrList, type HeaderTrust } from "./net";

export interface EngineConfig {
  slug: string;
  section: string;
  /** False when `_config` has never been readable: values are defaults and must not drive writes. */
  loaded: boolean;
  /** Id of the app's single website (`analytics_default_site_id`, else the app slug). */
  defaultSiteId: string;
  /** Main database name; raw shards are `<dbPrefix>_raw_<yyyy>_<mm>`. */
  dbPrefix: string;
  /** Where `dbPrefix` came from: the `_config` key, an existing legacy database, or the default. */
  dbPrefixSource: DbPrefixSource;
  rawRetentionMonths: number;
  respectDnt: boolean;
  ignoreIps: ReturnType<typeof parseCidrList>;
  geoSource: GeoSource;
  /** Which forwarding headers to trust for client IP and geo (see net.ts). */
  trustHeaders: HeaderTrust;
  aggregatorEnabled: boolean;
  persistentId: boolean;
  maxScanDays: number;
}

export type DbPrefixSource = "config" | "legacy" | "default";

/** Inputs for naming the database when `analytics_db_prefix` is unset. */
export interface DbNaming {
  /** The app's `runtimeConfig.dbLoginPrefix` (e.g. `prosti`). */
  loginPrefix?: unknown;
  /** True when the pre-2026-11 database `analytics_<slug>` already exists. */
  legacyDbExists?: boolean;
}

export const ENGINE_CONFIG_KEYS = [
  "analytics_default_site_id",
  "analytics_db_prefix",
  "analytics_raw_retention_months",
  "analytics_respect_dnt",
  "analytics_ignore_ips",
  "analytics_geo_source",
  "analytics_trust_headers",
  "analytics_aggregator_enabled",
  "analytics_persistent_id",
  "analytics_max_scan_days",
] as const;

const CACHE_TTL_MS = 60_000;

const text = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const bool = (value: unknown, fallback: boolean): boolean => {
  const raw = text(value)?.toLowerCase();
  if (raw === undefined || raw === null) return fallback;
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  return fallback;
};

const int = (value: unknown, fallback: number, min: number, max: number): number => {
  const parsed = Number.parseInt(text(value) ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

/** `header`, `timezone`, `auto` (header, then time zone) or `none`; anything else is `auto`. */
const parseGeoSource = (value: unknown): GeoSource => {
  const raw = text(value)?.toLowerCase();
  return raw === "header" || raw === "timezone" || raw === "none" ? raw : "auto";
};

/** `auto`, `cloudflare` or `all`; anything else is `auto`. */
const parseHeaderTrust = (value: unknown): HeaderTrust => {
  const raw = text(value)?.toLowerCase();
  return raw === "cloudflare" || raw === "all" ? raw : "auto";
};

const DB_NAME_PATTERN = /^[a-z][a-z0-9_$()+-]*$/;

/** Database name used before 2026-11 (`analytics_<slug>`). Existing installs keep it. */
export const legacyDbPrefix = (slug: string): string =>
  `analytics_${normalizeCouchEnvSlug(slug).replace(/-/g, "_") || "app"}`;

/**
 * Default database name for new installs: `<dbLoginPrefix>-analytics` (e.g. `prosti-analytics`),
 * matching the app's other databases. Falls back to the app slug when no usable login prefix is set.
 */
export const defaultDbPrefix = (slug: string, loginPrefix?: unknown): string => {
  const fromLogin = typeof loginPrefix === "string" ? loginPrefix.trim().toLowerCase().replace(/[-_]+$/, "") : "";
  if (fromLogin && DB_NAME_PATTERN.test(fromLogin)) return `${fromLogin}-analytics`;
  const fromSlug = normalizeCouchEnvSlug(slug);
  return `${DB_NAME_PATTERN.test(fromSlug) ? fromSlug : "app"}-analytics`;
};

/** Main database name: explicit `_config` key, else an existing legacy database, else the new default. */
const resolveDbPrefix = (
  explicit: string | null,
  slug: string,
  naming: DbNaming,
): { dbPrefix: string; dbPrefixSource: DbPrefixSource } => {
  const prefix = explicit?.toLowerCase();
  if (prefix && DB_NAME_PATTERN.test(prefix)) return { dbPrefix: prefix, dbPrefixSource: "config" };
  if (naming.legacyDbExists) return { dbPrefix: legacyDbPrefix(slug), dbPrefixSource: "legacy" };
  return { dbPrefix: defaultDbPrefix(slug, naming.loginPrefix), dbPrefixSource: "default" };
};

/** True when `analytics_db_prefix` holds a usable name (then no legacy lookup is needed). */
const hasExplicitDbPrefix = (values: Record<string, string | null | undefined>): boolean => {
  const prefix = text(values.analytics_db_prefix)?.toLowerCase();
  return Boolean(prefix && DB_NAME_PATTERN.test(prefix));
};

/** One website per app: an explicit id wins, otherwise it is derived from the app slug. */
const resolveSiteId = (explicit: string | null, slug: string): string => {
  const pattern = /^[a-z0-9][a-z0-9_-]{0,47}$/;
  const candidate = explicit?.toLowerCase();
  if (candidate && pattern.test(candidate)) return candidate;
  const fromSlug = normalizeCouchEnvSlug(slug).slice(0, 48);
  return pattern.test(fromSlug) ? fromSlug : "site";
};

/** Pure mapping from raw `_config` values to engine settings. */
export const buildEngineConfig = (
  slug: string,
  values: Record<string, string | null | undefined>,
  loaded = true,
  naming: DbNaming = {},
): EngineConfig => {
  return {
    slug,
    section: buildCouchEnvSection(slug),
    loaded,
    defaultSiteId: resolveSiteId(text(values.analytics_default_site_id), slug),
    ...resolveDbPrefix(text(values.analytics_db_prefix), slug, naming),
    rawRetentionMonths: int(values.analytics_raw_retention_months, 13, 1, 120),
    respectDnt: bool(values.analytics_respect_dnt, true),
    ignoreIps: parseCidrList(text(values.analytics_ignore_ips)),
    geoSource: parseGeoSource(values.analytics_geo_source),
    trustHeaders: parseHeaderTrust(values.analytics_trust_headers),
    aggregatorEnabled: bool(values.analytics_aggregator_enabled, true),
    persistentId: bool(values.analytics_persistent_id, false),
    maxScanDays: int(values.analytics_max_scan_days, 31, 1, 366),
  };
};

/** Retry delay after a failed `_config` read. */
const RETRY_MS = 5_000;

/**
 * Reads a whole `_config` section in one request. Throws when CouchDB can't
 * answer, unlike the shared per-key reader, which turns failures into "unset".
 * A missing section is simply empty.
 */
export const readConfigSection = async (section: string): Promise<Record<string, string>> => {
  if (!section) return {};
  const raw = await couch<Record<string, unknown>>(
    `_node/_local/_config/${encodeURIComponent(section)}`,
    {},
    { allow404: true, timeoutMs: 5_000 },
  );
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw ?? {})) {
    const parsed = typeof value === "string" ? parseCouchConfigString(value) : null;
    if (parsed !== null) values[key] = parsed;
  }
  return values;
};

/** Legacy-database lookups per slug. Only successful answers are kept; a failed lookup is retried. */
const legacyDbChecks = new Map<string, boolean>();

/**
 * Whether the pre-2026-11 database `analytics_<slug>` exists. Asked once per process:
 * installs that already have it keep using it, new installs never create it.
 * Throws when CouchDB can't answer, so the name is never guessed.
 */
const legacyDbExists = async (slug: string): Promise<boolean> => {
  const known = legacyDbChecks.get(slug);
  if (known !== undefined) return known;
  const info = await couch(encodeURIComponent(legacyDbPrefix(slug)), {}, { allow404: true, timeoutMs: 5_000 });
  const exists = info !== null;
  legacyDbChecks.set(slug, exists);
  return exists;
};

let cached: { expiresAt: number; config: EngineConfig } | null = null;
let inFlight: Promise<EngineConfig> | null = null;
/** Last config read successfully; survives cache resets. */
let lastGood: EngineConfig | null = null;
let failing = false;

/**
 * Resolves engine settings (cached for 60 s, concurrent reads deduplicated).
 * When the read fails it serves the last good settings (or a `loaded: false`
 * default before any) and retries after a few seconds.
 */
export const resolveEngineConfig = async (
  runtimeConfig: Record<string, any> = useRuntimeConfig(),
): Promise<EngineConfig> => {
  if (cached && Date.now() < cached.expiresAt) return cached.config;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const slug = resolveRuntimeAppSlug(runtimeConfig);
    const section = buildCouchEnvSection(slug);
    try {
      const values = await readConfigSection(section);
      const naming: DbNaming = {
        loginPrefix: runtimeConfig.dbLoginPrefix,
        legacyDbExists: hasExplicitDbPrefix(values) ? false : await legacyDbExists(slug),
      };
      const config = buildEngineConfig(slug, values, true, naming);
      lastGood = config;
      if (failing) console.info(`[analytics] _config ${section} is readable again`);
      failing = false;
      cached = { expiresAt: Date.now() + CACHE_TTL_MS, config };
      return config;
    } catch (error) {
      const fallback = lastGood?.slug === slug ? lastGood : buildEngineConfig(slug, {}, false, { loginPrefix: runtimeConfig.dbLoginPrefix });
      if (!failing) {
        const reason = error instanceof CouchError ? error.message : String(error);
        console.warn(
          `[analytics] could not read _config ${section} (${reason}); ` +
            (fallback.loaded ? "keeping the last settings that loaded" : "collection is paused until it can be read"),
        );
      }
      failing = true;
      cached = { expiresAt: Date.now() + RETRY_MS, config: fallback };
      return fallback;
    }
  })();
  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
};

/** Test seam / admin refresh: drops the memoized value (the last good config is kept). */
export const resetEngineConfigCache = (): void => {
  cached = null;
  inFlight = null;
};

/** Thrown by writers when settings were never loaded. Routes map it to 503. */
export const assertConfigLoaded = (config: EngineConfig): void => {
  if (!config.loaded) throw new CouchError(503, "config_unavailable", `_config ${config.section} could not be read`);
};
