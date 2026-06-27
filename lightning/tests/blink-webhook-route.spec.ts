import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEvent } from "h3";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";

const getDocumentMock = vi.fn();
const getViewMock = vi.fn();
const putDocumentMock = vi.fn();
const processWebhookMock = vi.fn();
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
    expect(putDocumentMock).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      "Blink webhook route skipping missing order document:",
      {
        invoiceId: "hash_paid",
        orderId: "donation-order-id",
        status: "paid",
      },
    );
  });
});
