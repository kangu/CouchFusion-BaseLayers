import { afterEach, describe, expect, it, vi } from "vitest";

const initializeDatabaseMock = vi.fn().mockResolvedValue(undefined);
const createBlinkProviderMock = vi.fn();
const createStrikeProviderMock = vi.fn();

vi.mock("#database/utils/couchdb", () => ({
  initializeDatabase: initializeDatabaseMock,
  validateCouchDBEnvironment: vi.fn(),
}));
vi.mock("../providers/blink", () => ({ createBlinkProvider: createBlinkProviderMock }));
vi.mock("../providers/strike", () => ({ createStrikeProvider: createStrikeProviderMock }));
vi.mock("../server/utils/lightning-config", () => ({
  resolveLightningConfigWithSources: async () => ({
    config: {
      defaultProvider: "blink_nc",
      providers: {
        blink_nc: {
          lightningAddress: "merchant@blink.sv",
          reconcileIntervalMs: 3_000,
          settlementGraceMs: 120_000,
          maxConcurrency: 5,
        },
      },
    },
    section: "cf_env_bitvocation",
    sources: {},
  }),
  assertLightningConfigReady: vi.fn(),
  logLightningConfigSourceNotices: vi.fn(),
}));

describe("blink_nc startup", () => {
  afterEach(() => vi.restoreAllMocks());

  it("delegates connection probing to reconciliation without registering a webhook or logging the address", async () => {
    (globalThis as any).useRuntimeConfig = () => ({ dbLoginPrefix: "bv" });
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const initialize = (await import("../server/plugins/init")).default;

    await initialize();

    expect(initializeDatabaseMock).toHaveBeenCalledWith("bv-orders", expect.any(Array));
    expect(createBlinkProviderMock).not.toHaveBeenCalled();
    expect(createStrikeProviderMock).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith(expect.stringContaining("blink_nc reconciliation performs"));
    expect(JSON.stringify(info.mock.calls)).not.toContain("merchant@blink.sv");
  });
});
