import {
  buildCouchEnvSection,
  readCouchConfigValues,
  resolveRuntimeAppSlug,
} from "#database/utils/couch-config";

type UmamiConfigSource = "couchdb" | "missing";

export interface UmamiConfigValueSource {
  key?: string;
  present: boolean;
  source: UmamiConfigSource;
}

export interface UmamiConfig {
  excludedPaths: string[];
  websiteId: string;
}

export interface ResolvedUmamiConfig {
  config: UmamiConfig;
  section: string;
  sources: Record<string, UmamiConfigValueSource>;
}

const CONFIG_KEYS = [
  "umami_website_id",
  "umami_excluded_paths",
  "NUXT_PUBLIC_UMAMI_EXCLUDED_PATHS",
];
const MISSING_CONFIG_CACHE_TTL_MS = 30_000;

const parseOptional = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseExcludedPaths = (value: unknown): string[] => {
  const parsed = parseOptional(value);
  if (!parsed) {
    return [];
  }

  return parsed
    .split(",")
    .map((path) => path.trim())
    .filter(Boolean);
};

/**
 * Resolves Umami settings from the app-scoped CouchDB _config section. Runtime
 * config is used only to discover the app slug.
 *
 * CouchDB is the only source, deliberately. `nuxt.config.ts` used to read
 * `UMAMI_WEBSITE_ID` under a plain, non-`NUXT_`-prefixed name, which Nuxt freezes
 * into the bundle at build time from whoever ran the build -- the production host
 * could not correct it. On 2026-08-24 a build carried an empty value and every
 * event site-wide was rejected with `500 Analytics websiteId missing`, silently,
 * because callers catch analytics failures by design. Keeping the build-time value
 * as a fallback would let a stale bundle mask exactly that misconfiguration.
 */
export const resolveUmamiConfigWithSources = async (
  runtimeConfig: Record<string, any> = useRuntimeConfig(),
): Promise<ResolvedUmamiConfig> => {
  const section = buildCouchEnvSection(resolveRuntimeAppSlug(runtimeConfig));
  const couchValues = await readCouchConfigValues(section, CONFIG_KEYS);
  const sources: Record<string, UmamiConfigValueSource> = {};

  const websiteId = parseOptional(couchValues.umami_website_id);
  sources.websiteId = {
    key: "umami_website_id",
    present: Boolean(websiteId),
    source: websiteId ? "couchdb" : "missing",
  };

  const canonicalExcludedPaths = parseOptional(
    couchValues.umami_excluded_paths,
  );
  const legacyExcludedPaths = parseOptional(
    couchValues.NUXT_PUBLIC_UMAMI_EXCLUDED_PATHS,
  );
  const excludedPathsValue = canonicalExcludedPaths || legacyExcludedPaths;
  const excludedPathsKey = canonicalExcludedPaths
    ? "umami_excluded_paths"
    : legacyExcludedPaths
      ? "NUXT_PUBLIC_UMAMI_EXCLUDED_PATHS"
      : "umami_excluded_paths";

  sources.excludedPaths = {
    key: excludedPathsKey,
    present: Boolean(excludedPathsValue),
    source: excludedPathsValue ? "couchdb" : "missing",
  };

  return {
    config: {
      excludedPaths: parseExcludedPaths(excludedPathsValue),
      websiteId: websiteId || "",
    },
    section,
    sources,
  };
};

const getRequiredCouchKeys = (resolved: ResolvedUmamiConfig): string[] => {
  return resolved.sources.websiteId?.present ? [] : ["umami_website_id"];
};

export const assertUmamiConfigReady = (resolved: ResolvedUmamiConfig): void => {
  const missing = getRequiredCouchKeys(resolved);
  if (missing.length > 0) {
    throw new Error(
      `Missing required Umami CouchDB config values in ${resolved.section}: ${missing.join(", ")}`,
    );
  }
};

const formatSource = (source: UmamiConfigValueSource): string => {
  if (source.source === "couchdb") {
    return `CouchDB key ${source.key}`;
  }
  return source.key ? `missing; checked CouchDB key ${source.key}` : "missing";
};

/**
 * Formats startup notices showing where Umami settings were resolved from
 * without printing the values.
 */
export const formatUmamiConfigSourceLog = (
  resolved: ResolvedUmamiConfig,
): string[] => {
  const lines = [`[analytics] required CouchDB config section: ${resolved.section}`];
  const websiteIdSource = resolved.sources.websiteId;

  if (websiteIdSource) {
    lines.push(
      `[analytics] websiteId: ${websiteIdSource.present ? "present" : "missing"} from ${formatSource(websiteIdSource)}`,
    );
  }

  const excludedPathsSource = resolved.sources.excludedPaths;
  if (excludedPathsSource) {
    lines.push(
      `[analytics] excludedPaths: ${excludedPathsSource.present ? "present" : "not configured"} from ${formatSource(excludedPathsSource)}`,
    );
  }

  return lines;
};

/**
 * Logs redacted Umami config source notices during Nitro startup.
 */
export const logUmamiConfigSourceNotices = (
  resolved: ResolvedUmamiConfig,
): void => {
  for (const line of formatUmamiConfigSourceLog(resolved)) {
    console.info(line);
  }
};

interface UmamiConfigCacheEntry {
  expiresAt: number | null;
  resolved: ResolvedUmamiConfig;
}

let cached: UmamiConfigCacheEntry | null = null;
let inFlight: Promise<ResolvedUmamiConfig> | null = null;

const isCacheEntryUsable = (entry: UmamiConfigCacheEntry): boolean => {
  return entry.expiresAt === null || Date.now() < entry.expiresAt;
};

const resolveCachedUmamiConfigWithSources = async (
  runtimeConfig: Record<string, any>,
): Promise<ResolvedUmamiConfig> => {
  if (cached && isCacheEntryUsable(cached)) {
    return cached.resolved;
  }

  if (inFlight) {
    return inFlight;
  }

  inFlight = resolveUmamiConfigWithSources(runtimeConfig);

  try {
    const resolved = await inFlight;
    cached = {
      expiresAt: resolved.config.websiteId
        ? null
        : Date.now() + MISSING_CONFIG_CACHE_TTL_MS,
      resolved,
    };
    return resolved;
  } finally {
    inFlight = null;
  }
};

/**
 * Resolves ready config for request handlers. Successful config is cached for
 * the process lifetime; missing required config is cached briefly so a broken
 * deployment cannot issue a CouchDB read for every tracked event.
 *
 * The one deliberate difference from the lightning layer, which re-reads on every
 * call: lightning resolves per checkout, this resolves per *tracked event*. A
 * CouchDB round trip on every pageview is a cost lightning never pays.
 *
 * Concurrent callers share the same in-flight read. A missing required value is
 * retried after 30 seconds so an operator can repair CouchDB without restarting.
 */
export const resolveUmamiConfig = async (
  runtimeConfig: Record<string, any> = useRuntimeConfig(),
): Promise<UmamiConfig> => {
  const resolved = await resolveCachedUmamiConfigWithSources(runtimeConfig);
  assertUmamiConfigReady(resolved);
  return resolved.config;
};

/** Test seam: drops the memoized value. */
export const resetUmamiConfigCache = (): void => {
  cached = null;
  inFlight = null;
};
