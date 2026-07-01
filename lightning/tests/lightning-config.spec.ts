import { beforeEach, describe, expect, it, vi } from "vitest";

const readCouchConfigValuesMock = vi.fn();

vi.mock("#database/utils/couch-config", () => {
  return {
    buildCouchEnvSection: (slug: string) => `cf_env_${slug}`,
    readCouchConfigValues: (...args: unknown[]) => readCouchConfigValuesMock(...args),
    resolveRuntimeAppSlug: (runtimeConfig: any) => runtimeConfig?.public?.appSlug || "bitvocation",
  };
});

describe("lightning config resolver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("useRuntimeConfig", () => ({
      public: {
        appSlug: "bitvocation",
      },
    }));
  });

  it("reads required Strike config from the app CouchDB config section", async () => {
    readCouchConfigValuesMock.mockResolvedValueOnce({
      lightning_default_provider: "strike",
      strike_api_key: "couch-strike-key",
      strike_webhook_secret: "couch-strike-secret",
    });

    const { resolveLightningConfigWithSources } = await import("../server/utils/lightning-config");
    const resolved = await resolveLightningConfigWithSources();

    expect(readCouchConfigValuesMock).toHaveBeenCalledWith("cf_env_bitvocation", expect.arrayContaining([
      "strike_api_key",
      "strike_webhook_secret",
      "blink_api_key",
    ]));
    expect(resolved.config.providers.strike?.apiKey).toBe("couch-strike-key");
    expect(resolved.config.providers.strike?.webhookSecret).toBe("couch-strike-secret");
    expect(resolved.sources.defaultProvider).toEqual({
      key: "lightning_default_provider",
      present: true,
      source: "couchdb",
    });
    expect(resolved.sources["providers.strike.apiKey"]).toEqual({
      key: "strike_api_key",
      present: true,
      source: "couchdb",
    });
    expect(resolved.sources["providers.strike.webhookSecret"]).toEqual({
      key: "strike_webhook_secret",
      present: true,
      source: "couchdb",
    });
  });

  it("uses CouchDB Lightning credentials ahead of runtime config values", async () => {
    vi.stubGlobal("useRuntimeConfig", () => ({
      public: {
        appSlug: "bitvocation",
      },
      lightning: {
        defaultProvider: "strike",
        providers: {
          strike: {
            apiKey: "runtime-strike-key",
            webhookSecret: "runtime-strike-secret",
          },
        },
      },
    }));
    readCouchConfigValuesMock.mockResolvedValueOnce({
      lightning_default_provider: "strike",
      strike_api_key: "couch-strike-key",
      strike_webhook_secret: "couch-strike-secret",
    });

    const { resolveLightningConfigWithSources } = await import("../server/utils/lightning-config");
    const resolved = await resolveLightningConfigWithSources();

    expect(resolved.config.providers.strike?.apiKey).toBe("couch-strike-key");
    expect(resolved.config.providers.strike?.webhookSecret).toBe("couch-strike-secret");
    expect(resolved.sources["providers.strike.apiKey"]?.source).toBe("couchdb");
    expect(resolved.sources["providers.strike.webhookSecret"]?.source).toBe("couchdb");
  });

  it("does not fall back to runtime Lightning credentials", async () => {
    vi.stubGlobal("useRuntimeConfig", () => ({
      public: {
        appSlug: "bitvocation",
      },
      lightning: {
        defaultProvider: "strike",
        providers: {
          strike: {
            apiKey: "runtime-strike-key",
            webhookSecret: "runtime-strike-secret",
          },
        },
      },
    }));
    readCouchConfigValuesMock.mockResolvedValueOnce({
      lightning_default_provider: "strike",
    });

    const { resolveLightningConfig } = await import("../server/utils/lightning-config");

    await expect(resolveLightningConfig()).rejects.toThrow(
      "Missing required Lightning CouchDB config values in cf_env_bitvocation: strike_api_key, strike_webhook_secret",
    );
  });

  it("requires lightning_default_provider in CouchDB config", async () => {
    readCouchConfigValuesMock.mockResolvedValueOnce({
      strike_api_key: "couch-strike-key",
      strike_webhook_secret: "couch-strike-secret",
    });

    const { resolveLightningConfig } = await import("../server/utils/lightning-config");

    await expect(resolveLightningConfig()).rejects.toThrow(
      "Missing required Lightning CouchDB config values in cf_env_bitvocation: lightning_default_provider",
    );
  });

  it("does not require Blink credentials when Strike is the selected provider", async () => {
    readCouchConfigValuesMock.mockResolvedValueOnce({
      lightning_default_provider: "strike",
      strike_api_key: "couch-strike-key",
      strike_webhook_secret: "couch-strike-secret",
    });

    const { resolveLightningConfig } = await import("../server/utils/lightning-config");
    const resolved = await resolveLightningConfig();

    expect(resolved.defaultProvider).toBe("strike");
    expect(resolved.providers.strike?.apiKey).toBe("couch-strike-key");
    expect(resolved.providers.blink).toBeUndefined();
  });

  it("requires Blink API key from CouchDB when Blink is the selected provider", async () => {
    readCouchConfigValuesMock.mockResolvedValueOnce({
      lightning_default_provider: "blink",
    });

    const { resolveLightningConfig } = await import("../server/utils/lightning-config");

    await expect(resolveLightningConfig()).rejects.toThrow(
      "Missing required Lightning CouchDB config values in cf_env_bitvocation: blink_api_key",
    );
  });

  it("formats source notices without leaking credential values", async () => {
    readCouchConfigValuesMock.mockResolvedValueOnce({
      lightning_default_provider: "strike",
      strike_api_key: "couch-strike-key",
      strike_webhook_secret: "couch-strike-secret",
      blink_api_key: "couch-blink-key",
      alby_access_token: "couch-alby-token",
    });

    const { formatLightningConfigSourceLog, resolveLightningConfigWithSources } = await import("../server/utils/lightning-config");
    const resolved = await resolveLightningConfigWithSources();
    const output = formatLightningConfigSourceLog(resolved).join("\n");

    expect(output).toContain("[lightning] required CouchDB config section: cf_env_bitvocation");
    expect(output).toContain("defaultProvider: present from CouchDB key lightning_default_provider");
    expect(output).toContain("providers.strike.apiKey: present from CouchDB key strike_api_key");
    expect(output).toContain("providers.strike.webhookSecret: present from CouchDB key strike_webhook_secret");
    expect(output).not.toContain("providers.blink");
    expect(output).not.toContain("providers.alby");
    expect(output).not.toContain("couch-strike-key");
    expect(output).not.toContain("couch-strike-secret");
    expect(output).not.toContain("couch-blink-key");
    expect(output).not.toContain("couch-alby-token");
  });

  it("formats source notices only for the selected Blink provider", async () => {
    readCouchConfigValuesMock.mockResolvedValueOnce({
      lightning_default_provider: "blink",
      strike_api_key: "couch-strike-key",
      strike_webhook_secret: "couch-strike-secret",
      blink_api_key: "couch-blink-key",
      blink_wallet_id: "couch-wallet-id",
      alby_access_token: "couch-alby-token",
    });

    const { formatLightningConfigSourceLog, resolveLightningConfigWithSources } = await import("../server/utils/lightning-config");
    const resolved = await resolveLightningConfigWithSources();
    const output = formatLightningConfigSourceLog(resolved).join("\n");

    expect(output).toContain("defaultProvider: present from CouchDB key lightning_default_provider");
    expect(output).toContain("providers.blink.apiKey: present from CouchDB key blink_api_key");
    expect(output).toContain("providers.blink.walletId: present from CouchDB key blink_wallet_id");
    expect(output).not.toContain("providers.strike");
    expect(output).not.toContain("providers.alby");
    expect(output).not.toContain("couch-blink-key");
    expect(output).not.toContain("couch-wallet-id");
  });

  it("does not format provider-specific notices before the provider is configured", async () => {
    readCouchConfigValuesMock.mockResolvedValueOnce({});

    const { formatLightningConfigSourceLog, resolveLightningConfigWithSources } = await import("../server/utils/lightning-config");
    const resolved = await resolveLightningConfigWithSources();
    const output = formatLightningConfigSourceLog(resolved).join("\n");

    expect(output).toContain("defaultProvider: missing from missing; checked CouchDB key lightning_default_provider");
    expect(output).not.toContain("providers.strike");
    expect(output).not.toContain("providers.blink");
    expect(output).not.toContain("providers.alby");
  });
});
