/**
 * Engine settings resolved from the app's CouchDB `_config` section
 * `cf_env_[appSlug]` (flat key/values). Cached briefly so operators can switch
 * modes without restarting.
 */
import {
  buildCouchEnvSection,
  normalizeCouchEnvSlug,
  readCouchConfigValues,
  resolveRuntimeAppSlug,
} from "#database/utils/couch-config";
import { parseCidrList } from "./net";

export type AnalyticsMode = "umami_cloud" | "self_hosted" | "dual";

export interface EngineConfig {
  slug: string;
  section: string;
  mode: AnalyticsMode;
  /** Id of the app's single website (`analytics_default_site_id`, else the app slug). */
  defaultSiteId: string;
  dbPrefix: string;
  rawRetentionMonths: number;
  respectDnt: boolean;
  ignoreIps: ReturnType<typeof parseCidrList>;
  geoSource: "header" | "none";
  aggregatorEnabled: boolean;
  persistentId: boolean;
  maxScanDays: number;
  /** Legacy/shared exclusions from `umami_excluded_paths`. */
  excludedPaths: string[];
}

export const ENGINE_CONFIG_KEYS = [
  "analytics_mode",
  "analytics_default_site_id",
  "analytics_db_prefix",
  "analytics_raw_retention_months",
  "analytics_respect_dnt",
  "analytics_ignore_ips",
  "analytics_geo_source",
  "analytics_aggregator_enabled",
  "analytics_persistent_id",
  "analytics_max_scan_days",
  "umami_excluded_paths",
  "NUXT_PUBLIC_UMAMI_EXCLUDED_PATHS",
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

export const parsePathList = (value: unknown): string[] =>
  (text(value) ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

/** Builds the default database prefix for an app slug. */
export const defaultDbPrefix = (slug: string): string =>
  `analytics_${normalizeCouchEnvSlug(slug).replace(/-/g, "_") || "app"}`;

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
): EngineConfig => {
  const modeRaw = text(values.analytics_mode)?.toLowerCase();
  const mode: AnalyticsMode =
    modeRaw === "self_hosted" || modeRaw === "dual" ? modeRaw : "umami_cloud";
  const prefix = text(values.analytics_db_prefix)?.toLowerCase();
  return {
    slug,
    section: buildCouchEnvSection(slug),
    mode,
    defaultSiteId: resolveSiteId(text(values.analytics_default_site_id), slug),
    dbPrefix: prefix && /^[a-z][a-z0-9_$()+-]*$/.test(prefix) ? prefix : defaultDbPrefix(slug),
    rawRetentionMonths: int(values.analytics_raw_retention_months, 13, 1, 120),
    respectDnt: bool(values.analytics_respect_dnt, true),
    ignoreIps: parseCidrList(text(values.analytics_ignore_ips)),
    geoSource: text(values.analytics_geo_source)?.toLowerCase() === "none" ? "none" : "header",
    aggregatorEnabled: bool(values.analytics_aggregator_enabled, true),
    persistentId: bool(values.analytics_persistent_id, false),
    maxScanDays: int(values.analytics_max_scan_days, 31, 1, 366),
    excludedPaths: parsePathList(
      text(values.umami_excluded_paths) ?? text(values.NUXT_PUBLIC_UMAMI_EXCLUDED_PATHS),
    ),
  };
};

let cached: { expiresAt: number; config: EngineConfig } | null = null;
let inFlight: Promise<EngineConfig> | null = null;

/** Resolves engine settings (cached for 60 s, concurrent reads deduplicated). */
export const resolveEngineConfig = async (
  runtimeConfig: Record<string, any> = useRuntimeConfig(),
): Promise<EngineConfig> => {
  if (cached && Date.now() < cached.expiresAt) return cached.config;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const slug = resolveRuntimeAppSlug(runtimeConfig);
    const values = await readCouchConfigValues(buildCouchEnvSection(slug), [...ENGINE_CONFIG_KEYS]);
    const config = buildEngineConfig(slug, values);
    cached = { expiresAt: Date.now() + CACHE_TTL_MS, config };
    return config;
  })();
  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
};

/** True when events are stored locally. */
export const storesLocally = (config: EngineConfig): boolean =>
  config.mode === "self_hosted" || config.mode === "dual";

/** True when events are forwarded to Umami Cloud. */
export const forwardsToUmami = (config: EngineConfig): boolean =>
  config.mode === "umami_cloud" || config.mode === "dual";

/** Test seam / admin refresh: drops the memoized value. */
export const resetEngineConfigCache = (): void => {
  cached = null;
  inFlight = null;
};
