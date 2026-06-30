import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEvent } from "h3";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";

const getDocumentMock = vi.fn();
const putDocumentMock = vi.fn();
const processWebhookMock = vi.fn();
const validateWebhookMock = vi.fn();
const publishMock = vi.fn();
const readCouchConfigValuesMock = vi.fn();

vi.mock("#database/utils/couchdb", () => ({
  getDocument: getDocumentMock,
  putDocument: putDocumentMock,
}));

vi.mock("#database/utils/couch-config", () => ({
  buildCouchEnvSection: (slug: string) => `cf_env_${slug}`,
  readCouchConfigValues: (...args: unknown[]) => readCouchConfigValuesMock(...args),
  resolveRuntimeAppSlug: (runtimeConfig: any) => runtimeConfig?.public?.appSlug || "bitvocation",
}));

vi.mock("../services/lightning", () => ({
  createLightningService: () => ({
    processWebhook: processWebhookMock,
    validateWebhook: validateWebhookMock,
  }),
}));

vi.mock("../server/utils/payment-event-bus", () => ({
  paymentEventBus: {
    publish: publishMock,
  },
}));

interface CreateEventOptions {
  body?: any;
  headers?: Record<string, string>;
}

const createMockEvent = (options: CreateEventOptions = {}) => {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  req.method = "POST";
  req.url = "/api/webhooks/strike";
  req.headers = Object.fromEntries(
    Object.entries(options.headers || {}).map(([key, value]) => [key.toLowerCase(), value]),
  );

  if (!req.headers["content-type"]) {
    req.headers["content-type"] = "application/json";
  }
  req.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body || {});

  const res = new ServerResponse(req);
  res.on("finish", () => socket.destroy());
  res.on("close", () => socket.destroy());
  const event = createEvent(req, res);
  event.context = {};
  return event;
};

describe("strike webhook route", () => {
  beforeEach(() => {
    getDocumentMock.mockReset();
    putDocumentMock.mockReset();
    processWebhookMock.mockReset();
    validateWebhookMock.mockReset();
    publishMock.mockReset();
    readCouchConfigValuesMock.mockReset();
    readCouchConfigValuesMock.mockResolvedValue({
      lightning_default_provider: "strike",
      strike_api_key: "strike_key",
      strike_webhook_secret: "strike_secret",
    });

    validateWebhookMock.mockReturnValue(true);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

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

  it("publishes scoped payment events after a paid invoice updates invoice and order docs", async () => {
    processWebhookMock.mockResolvedValue({
      eventId: "evt_paid_123",
      invoiceId: "inv_123",
      status: "paid",
      timestamp: "2026-06-26T20:00:00.000Z",
      metadata: {
        correlationId: "purchase_123",
      },
    });

    getDocumentMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        _id: "invoice-inv_123",
        orderId: "purchase_123",
        userName: "alice",
        invoiceData: {
          invoiceId: "inv_123",
          status: "pending",
        },
      })
      .mockResolvedValueOnce({
        _id: "purchase_123",
        userName: "alice",
        status: "pending_payment",
        content: {
          product: "pow_lab",
          validUntil: "2026-12-26T00:00:00.000Z",
        },
      })
      .mockResolvedValueOnce({
        _id: "org.couchdb.user:alice",
        name: "alice",
        pow_lab_invoice: "lnbc123",
        pow_lab_status: "pending_payment",
      });
    putDocumentMock.mockResolvedValue({ ok: true, id: "updated", rev: "2-updated" });

    const handler = (await import("../server/api/webhooks/strike.post")).default;
    const response = await handler(createMockEvent({
      body: {
        eventType: "invoice.updated",
        id: "evt_paid_123",
      },
      headers: {
        "x-webhook-signature": "valid",
      },
    }));

    expect(response).toEqual({
      success: true,
      processed: true,
      invoiceId: "inv_123",
      status: "paid",
    });
    expect(publishMock).toHaveBeenCalledWith(expect.objectContaining({
      id: "strike:evt_paid_123:invoice.paid",
      type: "invoice.paid",
      provider: "strike",
      invoiceId: "inv_123",
      orderId: "purchase_123",
      userName: "alice",
      status: "paid",
    }));
    expect(publishMock).toHaveBeenCalledWith(expect.objectContaining({
      id: "strike:evt_paid_123:order.fulfilled",
      type: "order.fulfilled",
      provider: "strike",
      invoiceId: "inv_123",
      orderId: "purchase_123",
      userName: "alice",
      status: "fulfilled",
    }));
    expect(putDocumentMock).toHaveBeenCalledWith("bv-orders", expect.objectContaining({
      _id: "payment-event:strike:evt_paid_123",
      processingStatus: "processed",
    }));
    expect(putDocumentMock).toHaveBeenCalledWith("_users", expect.objectContaining({
      _id: "org.couchdb.user:alice",
      pow_lab_invoice: "",
      pow_lab_status: "active",
      pow_lab_valid_until: "2026-12-26T00:00:00.000Z",
    }));
    expect(putDocumentMock).toHaveBeenCalledWith("bv-orders", expect.objectContaining({
      _id: "invoice-inv_123",
      lastEvent: "done",
      fulfillment: expect.objectContaining({
        status: "fulfilled",
        product: "pow_lab",
      }),
    }));
  });

  it("skips duplicate paid provider events that were already processed", async () => {
    processWebhookMock.mockResolvedValue({
      eventId: "evt_paid_123",
      invoiceId: "inv_123",
      status: "paid",
      timestamp: "2026-06-26T20:00:00.000Z",
      metadata: {
        correlationId: "purchase_123",
      },
    });
    getDocumentMock.mockResolvedValue({
      _id: "payment-event:strike:evt_paid_123",
      type: "payment_event",
      processingStatus: "processed",
      invoiceId: "inv_123",
    });

    const handler = (await import("../server/api/webhooks/strike.post")).default;
    const response = await handler(createMockEvent({
      body: {
        eventType: "invoice.updated",
        id: "evt_paid_123",
      },
      headers: {
        "x-webhook-signature": "valid",
      },
    }));

    expect(response).toEqual({
      success: true,
      processed: true,
      duplicate: true,
      invoiceId: "inv_123",
      status: "paid",
    });
    expect(putDocumentMock).not.toHaveBeenCalled();
    expect(publishMock).not.toHaveBeenCalled();
  });

  it("falls back to the stored invoice order id when Strike invoice metadata has no correlation id", async () => {
    processWebhookMock.mockResolvedValue({
      eventId: "evt_paid_without_correlation",
      invoiceId: "inv_123",
      status: "paid",
      timestamp: "2026-06-26T20:00:00.000Z",
      metadata: {
        eventType: "invoice.updated",
      },
    });

    getDocumentMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        _id: "invoice-inv_123",
        orderId: "purchase_123",
        userName: "alice",
        invoiceData: {
          invoiceId: "inv_123",
          status: "pending",
        },
      })
      .mockResolvedValueOnce({
        _id: "purchase_123",
        userName: "alice",
        status: "pending_payment",
        content: {
          product: "pow_lab",
          validUntil: "2026-12-26T00:00:00.000Z",
        },
      })
      .mockResolvedValueOnce({
        _id: "org.couchdb.user:alice",
        name: "alice",
        pow_lab_invoice: "lnbc123",
        pow_lab_status: "pending_payment",
      });
    putDocumentMock.mockResolvedValue({ ok: true, id: "updated", rev: "2-updated" });

    const handler = (await import("../server/api/webhooks/strike.post")).default;
    const response = await handler(createMockEvent({
      body: {
        eventType: "invoice.updated",
        id: "evt_paid_without_correlation",
      },
      headers: {
        "x-webhook-signature": "valid",
      },
    }));

    expect(response).toEqual({
      success: true,
      processed: true,
      invoiceId: "inv_123",
      status: "paid",
    });
    expect(putDocumentMock).toHaveBeenCalledWith("bv-orders", expect.objectContaining({
      _id: "purchase_123",
      status: "active",
    }));
    expect(publishMock).toHaveBeenCalledWith(expect.objectContaining({
      id: "strike:evt_paid_without_correlation:invoice.paid",
      orderId: "purchase_123",
      userName: "alice",
    }));
  });

  it("acknowledges invalid signatures without processing the webhook payload", async () => {
    validateWebhookMock.mockReturnValue(false);

    const handler = (await import("../server/api/webhooks/strike.post")).default;
    const response = await handler(createMockEvent({
      body: {
        eventType: "invoice.updated",
        id: "evt_invalid_signature",
      },
      headers: {
        "x-webhook-signature": "invalid",
      },
    }));

    expect(response).toEqual({
      success: true,
      processed: false,
      ignored: true,
      reason: "invalid_signature",
    });
    expect(processWebhookMock).not.toHaveBeenCalled();
    expect(getDocumentMock).not.toHaveBeenCalled();
    expect(putDocumentMock).not.toHaveBeenCalled();
    expect(publishMock).not.toHaveBeenCalled();
  });
});
