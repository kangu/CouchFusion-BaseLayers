import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEvent } from "h3";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";

const getDocumentMock = vi.fn();
const getSessionMock = vi.fn();
const createOrderMock = vi.fn();
const getProductPriceMock = vi.fn();
const saveInvoiceToDatabaseMock = vi.fn();
const replaceMemoTemplateMock = vi.fn();
const initializeMock = vi.fn();
const createPaymentMock = vi.fn();
const applyInvoiceCreatedFulfillmentMock = vi.fn();
const readCouchConfigValuesMock = vi.fn();

vi.mock("#database/utils/couchdb", () => ({
  getDocument: getDocumentMock,
  getSession: getSessionMock,
}));

vi.mock("#database/utils/couch-config", () => ({
  buildCouchEnvSection: (slug: string) => `cf_env_${slug}`,
  readCouchConfigValues: (...args: unknown[]) => readCouchConfigValuesMock(...args),
  resolveRuntimeAppSlug: (runtimeConfig: any) => runtimeConfig?.public?.appSlug || "bitvocation",
}));

vi.mock("../utils/orders", () => ({
  createOrder: createOrderMock,
  getProductPrice: getProductPriceMock,
  saveInvoiceToDatabase: saveInvoiceToDatabaseMock,
  replaceMemoTemplate: replaceMemoTemplateMock,
}));

vi.mock("../server/composables/useLightning", () => ({
  useLightning: () => ({
    initialize: initializeMock,
    createPayment: createPaymentMock,
  }),
}));

vi.mock("../server/utils/order-fulfillment", () => ({
  applyInvoiceCreatedFulfillment: applyInvoiceCreatedFulfillmentMock,
}));

const createMockEvent = (body: Record<string, unknown>) => {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  req.method = "POST";
  req.url = "/api/lightning/purchase";
  req.headers = {
    "content-type": "application/json",
  };
  req.body = JSON.stringify(body);

  const res = new ServerResponse(req);
  res.on("finish", () => socket.destroy());
  res.on("close", () => socket.destroy());
  const event = createEvent(req, res);
  event.context = {};
  return event;
};

describe("lightning purchase route", () => {
  beforeEach(() => {
    getDocumentMock.mockReset();
    getSessionMock.mockReset();
    createOrderMock.mockReset();
    getProductPriceMock.mockReset();
    saveInvoiceToDatabaseMock.mockReset();
    replaceMemoTemplateMock.mockReset();
    initializeMock.mockReset();
    createPaymentMock.mockReset();
    applyInvoiceCreatedFulfillmentMock.mockReset();
    readCouchConfigValuesMock.mockReset();
    readCouchConfigValuesMock.mockResolvedValue({
      lightning_default_provider: "strike",
      strike_api_key: "strike_key",
      strike_webhook_secret: "strike_secret",
    });

    (globalThis as any).useRuntimeConfig = () => ({
      dbLoginPrefix: "bv",
      public: {
        appSlug: "bitvocation",
      },
      lightning: {
        defaultProvider: "strike",
        providers: {
          strike: {
            apiKey: "strike_key",
            webhookSecret: "strike_secret",
          },
        },
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("applies created fulfillment after saving the invoice", async () => {
    getProductPriceMock.mockResolvedValue({
      memo: "PoW Lab",
      sats: 1000,
      valid_days: 180,
    });
    createOrderMock.mockResolvedValue("purchase_123");
    replaceMemoTemplateMock.mockReturnValue("PoW Lab");
    createPaymentMock.mockResolvedValue({
      id: "inv_123",
      paymentRequest: "lnbc123",
      status: "pending",
      amount: 1000,
      currency: "sats",
    });
    saveInvoiceToDatabaseMock.mockResolvedValue("invoice-inv_123");
    getDocumentMock
      .mockResolvedValueOnce({
        _id: "invoice-inv_123",
        userName: "alice",
        orderId: "purchase_123",
        invoiceData: {
          id: "inv_123",
          paymentRequest: "lnbc123",
          status: "pending",
        },
      })
      .mockResolvedValueOnce({
        _id: "purchase_123",
        userName: "alice",
        content: {
          product: "pow_lab",
        },
      });

    const handler = (await import("../server/api/lightning/purchase.post")).default;
    const response = await handler(createMockEvent({ product: "pow_lab" }));

    expect(response).toMatchObject({
      success: true,
      invoice: {
        id: "inv_123",
      },
    });
    expect(createOrderMock).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        product: "pow_lab",
        sats: 1000,
        valid_days: 180,
      }),
    }));
    expect(applyInvoiceCreatedFulfillmentMock).toHaveBeenCalledWith({
      ordersDatabase: "bv-orders",
      invoiceDoc: expect.objectContaining({ _id: "invoice-inv_123" }),
      orderDoc: expect.objectContaining({ _id: "purchase_123" }),
    });
  });
});
