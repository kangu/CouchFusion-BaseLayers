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
  websiteId: string;
}

export interface ResolvedUmamiConfig {
  config: UmamiConfig;
  section: string;
  sources: Record<string, UmamiConfigValueSource>;
}

const CONFIG_KEYS = ["umami_website_id"];

const parseOptional = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

  return {
    config: { websiteId: websiteId || "" },
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

let cached: UmamiConfig | null = null;

/**
 * Resolves the config for request handlers, reading CouchDB at most once per
 * process.
 *
 * The one deliberate difference from the lightning layer, which re-reads on every
 * call: lightning resolves per checkout, this resolves per *tracked event*. A
 * CouchDB round trip on every pageview is a cost lightning never pays.
 *
 * Only a resolved value is memoized. A missing one is a misconfiguration someone
 * is about to fix, and re-reading lets the fix land without a restart.
 * ponytail: that means one CouchDB read per event while broken -- acceptable
 * because the startup notices make the state loud and short-lived. Add a backoff
 * if it ever stops being either.
 */
export const resolveUmamiConfig = async (
  runtimeConfig: Record<string, any> = useRuntimeConfig(),
): Promise<UmamiConfig> => {
  if (cached) {
    return cached;
  }

  const resolved = await resolveUmamiConfigWithSources(runtimeConfig);
  if (resolved.config.websiteId) {
    cached = resolved.config;
  }

  return resolved.config;
};

/** Test seam: drops the memoized value. */
export const resetUmamiConfigCache = (): void => {
  cached = null;
};
