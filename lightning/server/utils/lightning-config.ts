import {
  buildCouchEnvSection,
  readCouchConfigValues,
  resolveRuntimeAppSlug,
} from "#database/utils/couch-config";
import type {
  AlbyConfig,
  BlinkConfig,
  LightningConfig,
  NwcConfig,
  StrikeConfig,
} from "../../types/lightning";

type LightningConfigSource = "couchdb" | "missing";

export interface LightningConfigValueSource {
  key?: string;
  present: boolean;
  source: LightningConfigSource;
}

export interface ResolvedLightningConfig {
  config: LightningConfig;
  section: string;
  sources: Record<string, LightningConfigValueSource>;
}

const CONFIG_KEYS = [
  "lightning_default_provider",
  "strike_api_key",
  "strike_webhook_secret",
  "strike_base_url",
  "blink_api_key",
  "blink_api_url",
  "blink_wallet_id",
  "blink_webhook_url",
  "blink_webhook_endpoint_id",
  "alby_api_url",
  "alby_access_token",
  "alby_webhook_url",
  "alby_webhook_endpoint_id",
  "alby_webhook_secret",
  "nwc_connection_uri",
  "nwc_reconcile_interval_ms",
];

const PROVIDERS = ["strike", "alby", "blink", "nwc"] as const;

const PROVIDER_SOURCE_PATHS: Record<LightningConfig["defaultProvider"], string[]> = {
  strike: [
    "providers.strike.apiKey",
    "providers.strike.webhookSecret",
    "providers.strike.baseUrl",
  ],
  blink: [
    "providers.blink.apiKey",
    "providers.blink.apiUrl",
    "providers.blink.walletId",
    "providers.blink.webhookUrl",
    "providers.blink.webhookEndpointId",
  ],
  alby: [
    "providers.alby.apiUrl",
    "providers.alby.accessToken",
    "providers.alby.webhookUrl",
    "providers.alby.webhookEndpointId",
    "providers.alby.webhookSecret",
  ],
  nwc: [
    "providers.nwc.connectionUri",
    "providers.nwc.reconcileIntervalMs",
  ],
};

const parseOptional = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeProvider = (value: string | null): LightningConfig["defaultProvider"] | null => {
  if (value === "strike" || value === "alby" || value === "blink" || value === "nwc") {
    return value;
  }

  return null;
};

const createValueResolver = (
  couchValues: Record<string, string | null>,
  sources: Record<string, LightningConfigValueSource>,
) => {
  return (
    path: string,
    couchKey: string,
  ): string => {
    const couchText = parseOptional(couchValues[couchKey]);
    if (couchText) {
      sources[path] = {
        key: couchKey,
        present: true,
        source: "couchdb",
      };
      return couchText;
    }

    sources[path] = {
      key: couchKey,
      present: false,
      source: "missing",
    };
    return "";
  };
};

const shouldIncludeProvider = (provider: Record<string, unknown> | undefined): boolean => {
  if (!provider) {
    return false;
  }

  return Object.values(provider).some((value) => parseOptional(value));
};

const parsePositiveInteger = (value: unknown): number | undefined => {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
};

/**
 * Resolves Lightning provider credentials from the app-scoped CouchDB _config
 * section. Runtime config is used only to discover the app slug.
 */
export const resolveLightningConfigWithSources = async (
  runtimeConfig: Record<string, any> = useRuntimeConfig(),
): Promise<ResolvedLightningConfig> => {
  const appSlug = resolveRuntimeAppSlug(runtimeConfig);
  const section = buildCouchEnvSection(appSlug);
  const couchValues = await readCouchConfigValues(section, CONFIG_KEYS);
  const sources: Record<string, LightningConfigValueSource> = {};
  const resolveValue = createValueResolver(couchValues, sources);

  const couchDefaultProvider = normalizeProvider(parseOptional(couchValues.lightning_default_provider));
  const defaultProvider = couchDefaultProvider || "strike";

  sources.defaultProvider = couchDefaultProvider
    ? {
        key: "lightning_default_provider",
        present: true,
        source: "couchdb",
      }
    : {
        key: "lightning_default_provider",
        present: false,
        source: "missing",
      };

  const strike: StrikeConfig = {
    apiKey: resolveValue(
      "providers.strike.apiKey",
      "strike_api_key",
    ),
    webhookSecret: resolveValue(
      "providers.strike.webhookSecret",
      "strike_webhook_secret",
    ),
    baseUrl: resolveValue(
      "providers.strike.baseUrl",
      "strike_base_url",
    ) || undefined,
  };

  const blink: BlinkConfig = {
    apiKey: resolveValue(
      "providers.blink.apiKey",
      "blink_api_key",
    ),
    apiUrl: resolveValue(
      "providers.blink.apiUrl",
      "blink_api_url",
    ) || undefined,
    walletId: resolveValue(
      "providers.blink.walletId",
      "blink_wallet_id",
    ) || undefined,
    webhookUrl: resolveValue(
      "providers.blink.webhookUrl",
      "blink_webhook_url",
    ) || undefined,
    webhookEndpointId: resolveValue(
      "providers.blink.webhookEndpointId",
      "blink_webhook_endpoint_id",
    ) || undefined,
  };

  const alby: AlbyConfig = {
    apiUrl: resolveValue(
      "providers.alby.apiUrl",
      "alby_api_url",
    ) || undefined,
    accessToken: resolveValue(
      "providers.alby.accessToken",
      "alby_access_token",
    ),
    webhookUrl: resolveValue(
      "providers.alby.webhookUrl",
      "alby_webhook_url",
    ) || undefined,
    webhookEndpointId: resolveValue(
      "providers.alby.webhookEndpointId",
      "alby_webhook_endpoint_id",
    ) || undefined,
    webhookSecret: resolveValue(
      "providers.alby.webhookSecret",
      "alby_webhook_secret",
    ) || undefined,
  };

  const nwc: NwcConfig = {
    connectionUri: resolveValue(
      "providers.nwc.connectionUri",
      "nwc_connection_uri",
    ),
    reconcileIntervalMs: parsePositiveInteger(couchValues.nwc_reconcile_interval_ms),
  };
  sources["providers.nwc.reconcileIntervalMs"] = {
    key: "nwc_reconcile_interval_ms",
    present: Boolean(nwc.reconcileIntervalMs),
    source: nwc.reconcileIntervalMs ? "couchdb" : "missing",
  };

  const resolvedProviders: LightningConfig["providers"] = {};
  if (shouldIncludeProvider(strike) || defaultProvider === "strike") {
    resolvedProviders.strike = strike;
  }
  if (shouldIncludeProvider(blink) || defaultProvider === "blink") {
    resolvedProviders.blink = blink;
  }
  if (shouldIncludeProvider(alby) || defaultProvider === "alby") {
    resolvedProviders.alby = alby;
  }
  if (shouldIncludeProvider(nwc) || defaultProvider === "nwc") {
    resolvedProviders.nwc = nwc;
  }

  for (const provider of PROVIDERS) {
    const providerConfigured = Boolean(resolvedProviders[provider]);
    sources[`providers.${provider}`] = {
      present: providerConfigured,
      source: providerConfigured ? "couchdb" : "missing",
    };
  }

  return {
    config: {
      defaultProvider,
      providers: resolvedProviders,
    },
    section,
    sources,
  };
};

const getRequiredCouchKeys = (
  resolved: ResolvedLightningConfig,
): string[] => {
  const missing: string[] = [];
  const provider = resolved.config.defaultProvider;

  if (!resolved.sources.defaultProvider?.present) {
    missing.push("lightning_default_provider");
    return missing;
  }

  if (provider === "strike") {
    if (!resolved.sources["providers.strike.apiKey"]?.present) {
      missing.push("strike_api_key");
    }
    if (!resolved.sources["providers.strike.webhookSecret"]?.present) {
      missing.push("strike_webhook_secret");
    }
  }

  if (provider === "blink" && !resolved.sources["providers.blink.apiKey"]?.present) {
    missing.push("blink_api_key");
  }

  if (provider === "alby" && !resolved.sources["providers.alby.accessToken"]?.present) {
    missing.push("alby_access_token");
  }

  if (provider === "nwc" && !resolved.sources["providers.nwc.connectionUri"]?.present) {
    missing.push("nwc_connection_uri");
  }

  return missing;
};

export const assertLightningConfigReady = (
  resolved: ResolvedLightningConfig,
): void => {
  const missing = getRequiredCouchKeys(resolved);
  if (missing.length > 0) {
    throw new Error(
      `Missing required Lightning CouchDB config values in ${resolved.section}: ${missing.join(", ")}`,
    );
  }
};

/**
 * Resolves the Lightning config without source metadata for request handlers.
 */
export const resolveLightningConfig = async (
  runtimeConfig: Record<string, any> = useRuntimeConfig(),
): Promise<LightningConfig> => {
  const resolved = await resolveLightningConfigWithSources(runtimeConfig);
  assertLightningConfigReady(resolved);
  return resolved.config;
};

const formatSource = (source: LightningConfigValueSource): string => {
  if (source.source === "couchdb") {
    return `CouchDB key ${source.key}`;
  }
  return source.key ? `missing; checked CouchDB key ${source.key}` : "missing";
};

/**
 * Formats startup notices that show where Lightning settings were resolved
 * from without printing credential values.
 */
export const formatLightningConfigSourceLog = (
  resolved: ResolvedLightningConfig,
): string[] => {
  const lines = [`[lightning] required CouchDB config section: ${resolved.section}`];
  const defaultProviderSource = resolved.sources.defaultProvider;

  if (defaultProviderSource) {
    lines.push(
      `[lightning] defaultProvider: ${defaultProviderSource.present ? "present" : "missing"} from ${formatSource(defaultProviderSource)}`,
    );
  }

  if (!defaultProviderSource?.present) {
    return lines;
  }

  for (const path of PROVIDER_SOURCE_PATHS[resolved.config.defaultProvider]) {
    const source = resolved.sources[path];
    if (source) {
      lines.push(
        `[lightning] ${path}: ${source.present ? "present" : "missing"} from ${formatSource(source)}`,
      );
    }
  }

  return lines;
};

/**
 * Logs redacted Lightning config source notices during Nitro startup.
 */
export const logLightningConfigSourceNotices = (
  resolved: ResolvedLightningConfig,
): void => {
  for (const line of formatLightningConfigSourceLog(resolved)) {
    console.info(line);
  }
};
