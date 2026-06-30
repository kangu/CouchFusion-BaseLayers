import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEvent } from "h3";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";

const getDocumentMock = vi.fn();
const getViewMock = vi.fn();
const putDocumentMock = vi.fn();
const processWebhookMock = vi.fn();
const publishMock = vi.fn();
const readCouchConfigValuesMock = vi.fn();
const updateLinkedInvoiceDocumentsMock = vi.fn();

vi.mock("#database/utils/couchdb", () => ({
  getDocument: getDocumentMock,
  getView: getViewMock,
  putDocument: putDocumentMock,
}));

vi.mock("#database/utils/couch-config", () => ({
  buildCouchEnvSection: (slug: string) => `cf_env_${slug}`,
  readCouchConfigValues: (...args: unknown[]) => readCouchConfigValuesMock(...args),
  resolveRuntimeAppSlug: (runtimeConfig: any) => runtimeConfig?.public?.appSlug || "bitvocation",
}));

vi.mock("#lightning/server/utils/invoice-links.mjs", () => ({
  updateLinkedInvoiceDocuments: updateLinkedInvoiceDocumentsMock,
}));

vi.mock("../services/lightning", () => ({
  createLightningService: () => ({
    processWebhook: processWebhookMock,
  }),
}));

vi.mock("../server/utils/payment-event-bus", () => ({
  paymentEventBus: {
    publish: publishMock,
  },
}));

interface CreateEventOptions {
  method?: string;
  path?: string;
  body?: any;
  headers?: Record<string, string>;
}

const createMockEvent = (options: CreateEventOptions = {}) => {
  const method = options.method || "POST";
  const path = options.path || "/api/webhooks/blink";
  const headers = Object.fromEntries(
    Object.entries(options.headers || {}).map(([key, value]) => [key.toLowerCase(), value]),
  );

  const socket = new Socket();
  const req = new IncomingMessage(socket);
  req.method = method;
  req.url = path;
  req.headers = headers;

  if (options.body !== undefined) {
    if (!req.headers["content-type"]) {
      req.headers["content-type"] = "application/json";
    }
    req.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
  }

  const res = new ServerResponse(req);
  res.on("finish", () => socket.destroy());
  res.on("close", () => socket.destroy());
  const event = createEvent(req, res);
  event.context = {};
  return event;
};

describe("blink webhook route", () => {
  beforeEach(() => {
    processWebhookMock.mockReset();
    publishMock.mockReset();
    getDocumentMock.mockReset();
    getViewMock.mockReset();
    putDocumentMock.mockReset();
    readCouchConfigValuesMock.mockReset();
    updateLinkedInvoiceDocumentsMock.mockReset();
    readCouchConfigValuesMock.mockResolvedValue({
      lightning_default_provider: "blink",
      blink_api_key: "blink_key",
    });
    updateLinkedInvoiceDocumentsMock.mockResolvedValue({ updated: 0, skipped: 0 });
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    (globalThis as any).useRuntimeConfig = () => ({
      dbLoginPrefix: "cf",
      public: {
        appSlug: "bitvocation",
      },
      lightning: {
        defaultProvider: "blink",
        providers: {
          blink: {
            apiKey: "blink_key",
          },
        },
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("returns success for donation-style invoices when the linked order document does not exist", async () => {
    processWebhookMock.mockResolvedValue({
      invoiceId: "hash_paid",
      status: "paid",
      amount: 1200,
      currency: "sats",
    });

    getDocumentMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        _id: "invoice-hash_paid",
        orderId: "donation-order-id",
        invoiceData: {
          invoiceId: "hash_paid",
          status: "pending",
        },
      })
      .mockResolvedValueOnce(null);

    putDocumentMock.mockResolvedValue({ ok: true, id: "invoice-hash_paid" });

    const handler = (await import("../server/api/webhooks/blink.post")).default;
    const event = createMockEvent({
      body: {
        eventType: "receive.lightning",
        transaction: {
          status: "success",
          initiationVia: {
            paymentHash: "hash_paid",
          },
        },
      },
    });

    const response = await handler(event);

    expect(response).toEqual({
      success: true,
      processed: true,
      invoiceId: "hash_paid",
      status: "paid",
    });
    expect(putDocumentMock).toHaveBeenCalledTimes(3);
    expect(console.warn).toHaveBeenCalledWith(
      "Blink webhook route skipping missing order document:",
      {
        invoiceId: "hash_paid",
        orderId: "donation-order-id",
        status: "paid",
      },
    );
  });

  it("publishes scoped payment events after a paid invoice updates invoice, order, and user docs", async () => {
    processWebhookMock.mockResolvedValue({
      invoiceId: "hash_paid",
      status: "paid",
      amount: 21000,
      currency: "sats",
      timestamp: new Date("2026-06-27T21:30:00.000Z"),
      metadata: {
        provider: "blink",
      },
    });

    getDocumentMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        _id: "invoice-hash_paid",
        orderId: "purchase_123",
        userName: "alice",
        invoiceData: {
          invoiceId: "hash_paid",
          status: "pending",
          paymentRequest: "lnbcblink",
        },
      })
      .mockResolvedValueOnce({
        _id: "purchase_123",
        userName: "alice",
        status: "pending_payment",
        content: {
          product: "pow_lab_lite",
          validUntil: "2026-12-27T21:30:00.000Z",
        },
      })
      .mockResolvedValueOnce({
        _id: "org.couchdb.user:alice",
        name: "alice",
        pow_lab_lite_invoice: "lnbcblink",
        pow_lab_lite_status: "pending_payment",
      });
    putDocumentMock.mockResolvedValue({ ok: true, id: "updated", rev: "2-updated" });

    const handler = (await import("../server/api/webhooks/blink.post")).default;
    const response = await handler(createMockEvent({
      body: {
        eventType: "receive.lightning",
        transaction: {
          id: "blink_tx_123",
          status: "success",
          initiationVia: {
            paymentHash: "hash_paid",
          },
        },
      },
    }));

    expect(response).toEqual({
      success: true,
      processed: true,
      invoiceId: "hash_paid",
      status: "paid",
    });
    expect(putDocumentMock).toHaveBeenCalledWith("cf-orders", expect.objectContaining({
      _id: "payment-event:blink:blink_tx_123",
      _rev: "2-updated",
      processingStatus: "processed",
      provider: "blink",
      invoiceId: "hash_paid",
      orderId: "purchase_123",
      userName: "alice",
    }));
    expect(putDocumentMock).toHaveBeenCalledWith("_users", expect.objectContaining({
      _id: "org.couchdb.user:alice",
      pow_lab_lite_invoice: "",
      pow_lab_lite_invoice_id: "",
      pow_lab_lite_order_id: "",
      pow_lab_lite_status: "active",
      pow_lab_lite_valid_until: "2026-12-27T21:30:00.000Z",
    }));
    expect(putDocumentMock).toHaveBeenCalledWith("cf-orders", expect.objectContaining({
      _id: "invoice-hash_paid",
      _rev: "2-updated",
      lastEvent: "done",
      fulfillment: expect.objectContaining({
        status: "fulfilled",
        product: "pow_lab_lite",
      }),
    }));
    expect(publishMock).toHaveBeenCalledWith(expect.objectContaining({
      id: "blink:blink_tx_123:invoice.paid",
      type: "invoice.paid",
      provider: "blink",
      invoiceId: "hash_paid",
      orderId: "purchase_123",
      userName: "alice",
      status: "paid",
    }));
    expect(publishMock).toHaveBeenCalledWith(expect.objectContaining({
      id: "blink:blink_tx_123:order.fulfilled",
      type: "order.fulfilled",
      provider: "blink",
      invoiceId: "hash_paid",
      orderId: "purchase_123",
      userName: "alice",
      status: "fulfilled",
    }));
  });

  it("skips duplicate paid Blink provider events that were already processed", async () => {
    processWebhookMock.mockResolvedValue({
      invoiceId: "hash_paid",
      status: "paid",
      amount: 21000,
      currency: "sats",
      timestamp: new Date("2026-06-27T21:30:00.000Z"),
      metadata: {
        provider: "blink",
      },
    });

    getDocumentMock.mockResolvedValue({
      _id: "payment-event:blink:blink_tx_123",
      type: "payment_event",
      processingStatus: "processed",
      invoiceId: "hash_paid",
    });

    const handler = (await import("../server/api/webhooks/blink.post")).default;
    const response = await handler(createMockEvent({
      body: {
        eventType: "receive.lightning",
        transaction: {
          id: "blink_tx_123",
          status: "success",
          initiationVia: {
            paymentHash: "hash_paid",
          },
        },
      },
    }));

    expect(response).toEqual({
      success: true,
      processed: true,
      duplicate: true,
      invoiceId: "hash_paid",
      status: "paid",
    });
    expect(putDocumentMock).not.toHaveBeenCalled();
    expect(updateLinkedInvoiceDocumentsMock).not.toHaveBeenCalled();
    expect(publishMock).not.toHaveBeenCalled();
  });
});
