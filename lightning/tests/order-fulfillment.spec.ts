import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getDocumentMock = vi.fn();
const putDocumentMock = vi.fn();

vi.mock("#database/utils/couchdb", () => ({
  getDocument: getDocumentMock,
  putDocument: putDocumentMock,
}));

describe("embedded order fulfillment", () => {
  beforeEach(() => {
    vi.useRealTimers();
    getDocumentMock.mockReset();
    putDocumentMock.mockReset();
    putDocumentMock.mockResolvedValue({ ok: true, id: "updated", rev: "2-updated" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores pending PoW Lab invoices on the user document when invoices are created", async () => {
    const { applyInvoiceCreatedFulfillment } = await import("../server/utils/order-fulfillment");
    getDocumentMock.mockResolvedValue({
      _id: "org.couchdb.user:alice",
      name: "alice",
    });

    await applyInvoiceCreatedFulfillment({
      ordersDatabase: "bv--orders",
      invoiceDoc: {
        _id: "invoice-inv_123",
        userName: "alice",
        orderId: "purchase_123",
        invoiceData: {
          id: "inv_123",
          paymentRequest: "lnbc123",
        },
      },
      orderDoc: {
        _id: "purchase_123",
        userName: "alice",
        content: {
          product: "pow_lab",
        },
      },
    });

    expect(putDocumentMock).toHaveBeenCalledWith("_users", expect.objectContaining({
      _id: "org.couchdb.user:alice",
      pow_lab_invoice: "lnbc123",
      pow_lab_invoice_id: "inv_123",
      pow_lab_order_id: "purchase_123",
    }));
  });

  it("marks PoW Lab users active and invoice docs done when invoices are paid", async () => {
    const { applyInvoicePaidFulfillment } = await import("../server/utils/order-fulfillment");
    getDocumentMock.mockResolvedValue({
      _id: "org.couchdb.user:alice",
      name: "alice",
      pow_lab_invoice: "lnbc123",
      pow_lab_invoice_id: "inv_123",
      pow_lab_order_id: "purchase_123",
      pow_lab_status: "pending_payment",
    });

    await applyInvoicePaidFulfillment({
      ordersDatabase: "bv--orders",
      invoiceDoc: {
        _id: "invoice-inv_123",
        _rev: "2-paid",
        userName: "alice",
        orderId: "purchase_123",
        lastEvent: "paid",
        invoiceData: {
          invoiceId: "inv_123",
          paymentRequest: "lnbc123",
          status: "paid",
        },
      },
      orderDoc: {
        _id: "purchase_123",
        userName: "alice",
        status: "active",
        content: {
          product: "pow_lab",
          validUntil: "2026-12-26T00:00:00.000Z",
        },
      },
    });

    expect(putDocumentMock).toHaveBeenCalledWith("_users", expect.objectContaining({
      _id: "org.couchdb.user:alice",
      pow_lab_invoice: "",
      pow_lab_invoice_id: "",
      pow_lab_order_id: "",
      pow_lab_status: "active",
      pow_lab_valid_until: "2026-12-26T00:00:00.000Z",
    }));
    expect(putDocumentMock).toHaveBeenCalledWith("bv--orders", expect.objectContaining({
      _id: "invoice-inv_123",
      lastEvent: "done",
      fulfillment: expect.objectContaining({
        status: "fulfilled",
        product: "pow_lab",
      }),
    }));
  });

  it("marks PoW Lab Lite users active with the order validity window when invoices are paid", async () => {
    const { applyInvoicePaidFulfillment } = await import("../server/utils/order-fulfillment");
    getDocumentMock.mockResolvedValue({
      _id: "org.couchdb.user:alice",
      name: "alice",
      pow_lab_lite_invoice: "lnbc123",
      pow_lab_lite_invoice_id: "inv_123",
      pow_lab_lite_order_id: "purchase_123",
      pow_lab_lite_status: "pending_payment",
    });

    await applyInvoicePaidFulfillment({
      ordersDatabase: "bv--orders",
      invoiceDoc: {
        _id: "invoice-inv_123",
        _rev: "2-paid",
        userName: "alice",
        orderId: "purchase_123",
        lastEvent: "paid",
        invoiceData: {
          invoiceId: "inv_123",
          paymentRequest: "lnbc123",
          status: "paid",
        },
      },
      orderDoc: {
        _id: "purchase_123",
        userName: "alice",
        status: "active",
        content: {
          product: "pow_lab_lite",
          validUntil: "2026-12-26T00:00:00.000Z",
        },
      },
    });

    expect(putDocumentMock).toHaveBeenCalledWith("_users", expect.objectContaining({
      _id: "org.couchdb.user:alice",
      pow_lab_lite_invoice: "",
      pow_lab_lite_invoice_id: "",
      pow_lab_lite_order_id: "",
      pow_lab_lite_status: "active",
      pow_lab_lite_valid_until: "2026-12-26T00:00:00.000Z",
    }));
  });

  it("extends memberships from the current user validity when paid orders only carry valid_days", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-30T12:00:00.000Z"));

    const { applyInvoicePaidFulfillment } = await import("../server/utils/order-fulfillment");
    getDocumentMock.mockResolvedValue({
      _id: "org.couchdb.user:alice",
      name: "alice",
      pow_lab_invoice: "lnbc123",
      pow_lab_invoice_id: "inv_123",
      pow_lab_order_id: "purchase_123",
      pow_lab_status: "pending_payment",
      pow_lab_valid_until: "2026-12-31T00:00:00.000Z",
    });

    await applyInvoicePaidFulfillment({
      ordersDatabase: "bv--orders",
      invoiceDoc: {
        _id: "invoice-inv_123",
        _rev: "2-paid",
        userName: "alice",
        orderId: "purchase_123",
        lastEvent: "paid",
        invoiceData: {
          invoiceId: "inv_123",
          paymentRequest: "lnbc123",
          status: "paid",
        },
      },
      orderDoc: {
        _id: "purchase_123",
        userName: "alice",
        status: "active",
        content: {
          product: "pow_lab",
          valid_days: 180,
        },
      },
    });

    expect(putDocumentMock).toHaveBeenCalledWith("_users", expect.objectContaining({
      _id: "org.couchdb.user:alice",
      pow_lab_status: "active",
      pow_lab_valid_until: "2027-06-29T00:00:00.000Z",
    }));
  });

  it("extends Lite memberships from the current user validity when paid orders only carry valid_days", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-30T12:00:00.000Z"));

    const { applyInvoicePaidFulfillment } = await import("../server/utils/order-fulfillment");
    getDocumentMock.mockResolvedValue({
      _id: "org.couchdb.user:alice",
      name: "alice",
      pow_lab_lite_invoice: "lnbc123",
      pow_lab_lite_invoice_id: "inv_123",
      pow_lab_lite_order_id: "purchase_123",
      pow_lab_lite_status: "pending_payment",
      pow_lab_lite_valid_until: "2026-09-30T00:00:00.000Z",
    });

    await applyInvoicePaidFulfillment({
      ordersDatabase: "bv--orders",
      invoiceDoc: {
        _id: "invoice-inv_123",
        _rev: "2-paid",
        userName: "alice",
        orderId: "purchase_123",
        lastEvent: "paid",
        invoiceData: {
          invoiceId: "inv_123",
          paymentRequest: "lnbc123",
          status: "paid",
        },
      },
      orderDoc: {
        _id: "purchase_123",
        userName: "alice",
        status: "active",
        content: {
          product: "pow_lab_lite",
          valid_days: 90,
        },
      },
    });

    expect(putDocumentMock).toHaveBeenCalledWith("_users", expect.objectContaining({
      _id: "org.couchdb.user:alice",
      pow_lab_lite_status: "active",
      pow_lab_lite_valid_until: "2026-12-29T00:00:00.000Z",
    }));
  });

  it("marks conference submissions paid without requiring a validity date", async () => {
    const { applyInvoicePaidFulfillment } = await import("../server/utils/order-fulfillment");
    getDocumentMock.mockResolvedValue({
      _id: "org.couchdb.user:alice",
      name: "alice",
      conference_submission_invoice: "lnbc123",
      conference_submission_invoice_id: "inv_123",
      conference_submission_order_id: "purchase_123",
      conference_submission_status: "pending_payment",
    });

    await applyInvoicePaidFulfillment({
      ordersDatabase: "bv--orders",
      invoiceDoc: {
        _id: "invoice-inv_123",
        _rev: "2-paid",
        userName: "alice",
        orderId: "purchase_123",
        lastEvent: "paid",
        invoiceData: {
          invoiceId: "inv_123",
          paymentRequest: "lnbc123",
          status: "paid",
        },
      },
      orderDoc: {
        _id: "purchase_123",
        userName: "alice",
        status: "active",
        content: {
          product: "conference_submission",
        },
      },
    });

    expect(putDocumentMock).toHaveBeenCalledWith("_users", expect.objectContaining({
      _id: "org.couchdb.user:alice",
      conference_submission_invoice: "",
      conference_submission_invoice_id: "",
      conference_submission_order_id: "",
      conference_submission_status: "paid",
    }));
  });
});
