import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEvent } from "h3";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";

const assertInvisibleFormShieldMock = vi.fn();
const assertProofOfWorkMock = vi.fn();
const getProductPriceMock = vi.fn();
const replaceMemoTemplateMock = vi.fn();
const putDocumentMock = vi.fn();
const initializeMock = vi.fn();
const createPaymentMock = vi.fn();

vi.mock("#auth/server/utils/invisible-form-shield", () => ({
  assertInvisibleFormShield: (...args: unknown[]) => assertInvisibleFormShieldMock(...args),
}));
vi.mock("#auth/server/utils/proof-of-work-runtime", () => ({
  assertProofOfWork: (...args: unknown[]) => assertProofOfWorkMock(...args),
}));
vi.mock("#database/utils/couchdb", () => ({
  putDocument: (...args: unknown[]) => putDocumentMock(...args),
}));
vi.mock("../utils/orders", () => ({
  getProductPrice: (...args: unknown[]) => getProductPriceMock(...args),
  replaceMemoTemplate: (...args: unknown[]) => replaceMemoTemplateMock(...args),
}));
vi.mock("../server/composables/useLightning", () => ({
  useLightning: () => ({ initialize: initializeMock, createPayment: createPaymentMock }),
}));
vi.mock("../server/utils/lightning-config", () => ({
  resolveLightningConfig: async () => ({ defaultProvider: "strike" }),
}));

const createMockEvent = (body: Record<string, unknown>) => {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  req.method = "POST";
  req.url = "/api/lightning/career-hub-checkout";
  req.headers = { "content-type": "application/json" };
  req.body = JSON.stringify(body);
  const res = new ServerResponse(req);
  const event = createEvent(req, res);
  event.context = {};
  return event;
};

describe("Career Hub guest checkout route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).useRuntimeConfig = () => ({ dbLoginPrefix: "bv" });
    getProductPriceMock.mockResolvedValue({ memo: "Career Hub", sats: 100, valid_days: 30 });
    replaceMemoTemplateMock.mockReturnValue("Career Hub");
    createPaymentMock.mockResolvedValue({
      id: "invoice-123", paymentRequest: "lnbc123", amount: 100, status: "pending", expiresAt: "2026-08-17T10:00:00.000Z",
    });
    putDocumentMock.mockResolvedValue({ ok: true, rev: "1-test" });
  });

  afterEach(() => vi.resetModules());

  it("creates a protected pow lab lite guest invoice", async () => {
    const handler = (await import("../server/api/lightning/career-hub-checkout.post")).default;
    const response = await handler(createMockEvent({
      email: " Member@Example.com ", invisibleShield: { startedAt: Date.now() - 1000 }, proofOfWork: { token: "token" },
    }));

    expect(assertInvisibleFormShieldMock).toHaveBeenCalledWith(expect.anything(), { purpose: "career_hub_checkout" });
    expect(assertProofOfWorkMock).toHaveBeenCalledWith(expect.anything(), "career_hub_checkout");
    expect(response).toMatchObject({ success: true, checkoutToken: expect.stringMatching(/^[a-f0-9]{64}$/), invoice: { paymentRequest: "lnbc123" } });
    expect(putDocumentMock).toHaveBeenCalledWith("bv-orders", expect.objectContaining({
      guestEmail: "member@example.com",
      content: expect.objectContaining({ product: "pow_lab_lite", checkoutType: "career_hub_guest", sats: 100, valid_days: 30 }),
    }));
    expect(putDocumentMock).toHaveBeenCalledWith("bv-orders", expect.objectContaining({
      type: "lightning_invoice", orderId: expect.any(String), guestCheckoutTokenHash: expect.any(String),
    }));
  });
});
