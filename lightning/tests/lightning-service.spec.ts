import { beforeEach, describe, expect, it, vi } from "vitest";

const getInvoiceStatusMock = vi.fn().mockResolvedValue({
  invoiceId: "hash-1",
  amount: 21,
  currency: "sats",
  status: "pending",
  provider: "blink_nc",
});
const createBlinkNcProviderMock = vi.fn(() => ({
  createInvoice: vi.fn(),
  getInvoiceStatus: getInvoiceStatusMock,
  validateWebhook: vi.fn(() => false),
  processWebhook: vi.fn(async () => null),
}));

vi.mock("../providers/blink-nc", () => ({
  createBlinkNcProvider: createBlinkNcProviderMock,
}));

describe("Lightning service blink_nc routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("constructs blink_nc and forwards persisted lookup context", async () => {
    const { createLightningService } = await import("../services/lightning");
    const blinkNcConfig = {
      lightningAddress: "merchant@blink.sv",
      reconcileIntervalMs: 3_000,
      settlementGraceMs: 120_000,
      maxConcurrency: 5,
    };
    const service = createLightningService({
      defaultProvider: "blink_nc",
      providers: { blink_nc: blinkNcConfig },
    });
    const context = {
      paymentRequest: "lnbc1persisted",
      amount: 21,
      paymentContext: { verifyUrl: "https://lnurl.blink.sv/verify/hash-1" },
    };

    await expect(service.getInvoiceStatus("hash-1", "blink_nc", context)).resolves.toMatchObject({
      invoiceId: "hash-1",
      provider: "blink_nc",
    });
    expect(createBlinkNcProviderMock).toHaveBeenCalledWith(blinkNcConfig);
    expect(getInvoiceStatusMock).toHaveBeenCalledWith("hash-1", context);
  });

  it("fails closed when blink_nc is selected without provider configuration", async () => {
    const { createLightningService } = await import("../services/lightning");
    const service = createLightningService({ defaultProvider: "blink_nc", providers: {} });

    await expect(service.getInvoiceStatus("hash-1")).rejects.toThrow("Blink non-custodial provider not configured");
  });
});
