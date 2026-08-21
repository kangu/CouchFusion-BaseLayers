import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEvent } from "h3";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";

const initializeMock = vi.fn();
const createPaymentMock = vi.fn();
const saveInvoiceToDatabaseMock = vi.fn();

vi.mock("#imports", () => ({
  useRuntimeConfig: () => (globalThis as any).useRuntimeConfig(),
}));

vi.mock("../server/composables/useLightning", () => ({
  useLightning: () => ({ initialize: initializeMock, createPayment: createPaymentMock }),
}));
vi.mock("../utils/orders", () => ({ saveInvoiceToDatabase: saveInvoiceToDatabaseMock }));
vi.mock("../server/utils/lightning-config", () => ({
  resolveLightningConfig: async () => ({ defaultProvider: "blink_nc", providers: {} }),
}));

const createMockEvent = () => {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  req.method = "POST";
  req.url = "/api/lightning/donation";
  req.headers = { "content-type": "application/json" };
  req.body = JSON.stringify({ amount: 21, memo: "Donation" });
  const res = new ServerResponse(req);
  const event = createEvent(req, res);
  event.context = {};
  return event;
};

describe("lightning donation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).useRuntimeConfig = () => ({ dbLoginPrefix: "bv" });
    createPaymentMock.mockResolvedValue({
      id: "invoice-123",
      invoiceId: "invoice-123",
      paymentRequest: "lnbc123",
      amount: 21,
      currency: "sats",
      status: "pending",
      provider: "blink_nc",
      expiresAt: new Date("2026-08-21T19:00:00.000Z"),
      paymentContext: { verifyUrl: "https://lnurl.blink.sv/verify/invoice-123" },
    });
    saveInvoiceToDatabaseMock.mockResolvedValue("invoice-invoice-123");
  });

  afterEach(() => vi.resetModules());

  it("persists internal blink_nc context but returns only public invoice fields", async () => {
    const handler = (await import("../server/api/lightning/donation.post")).default;
    const response = await handler(createMockEvent());

    expect(saveInvoiceToDatabaseMock).toHaveBeenCalledWith(expect.objectContaining({
      invoiceData: expect.objectContaining({
        paymentContext: { verifyUrl: "https://lnurl.blink.sv/verify/invoice-123" },
      }),
    }));
    expect(response).toMatchObject({ invoiceId: "invoice-123", provider: "blink_nc", paymentRequest: "lnbc123" });
    expect(JSON.stringify(response)).not.toContain("verifyUrl");
  });

  it("does not attempt persistence when invoice creation returns no payment", async () => {
    createPaymentMock.mockResolvedValueOnce(null);
    const handler = (await import("../server/api/lightning/donation.post")).default;

    await expect(handler(createMockEvent())).rejects.toMatchObject({ statusCode: 500 });
    expect(saveInvoiceToDatabaseMock).not.toHaveBeenCalled();
  });
});
