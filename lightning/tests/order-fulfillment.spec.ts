import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getDocumentMock = vi.fn();
const putDocumentMock = vi.fn();
const getViewMock = vi.fn();
const createUserMock = vi.fn();
const queueTemplateEmailMock = vi.fn();
const createLoginTokenMock = vi.fn();

vi.mock("#database/utils/couchdb", () => ({
  getDocument: getDocumentMock,
  putDocument: putDocumentMock,
  getView: getViewMock,
  createUser: createUserMock,
}));

vi.mock("#email/server/utils/template-queue", () => ({
  queueTemplateEmail: (...args: unknown[]) => queueTemplateEmailMock(...args),
}));

vi.mock("#auth/server/utils/login-token", () => ({
  createLoginToken: (...args: unknown[]) => createLoginTokenMock(...args),
}));

describe("embedded order fulfillment", () => {
  beforeEach(() => {
    (globalThis as any).useRuntimeConfig = () => ({
      dbLoginPrefix: "bv",
      public: { siteUrl: "https://bitvocation.com" },
    });
    vi.useRealTimers();
    getDocumentMock.mockReset();
    putDocumentMock.mockReset();
    queueTemplateEmailMock.mockReset();
    getViewMock.mockReset();
    createUserMock.mockReset();
    createLoginTokenMock.mockReset();
    putDocumentMock.mockResolvedValue({ ok: true, id: "updated", rev: "2-updated" });
    queueTemplateEmailMock.mockResolvedValue({
      ok: true,
      providerMessageId: "queued-message-id",
      errorMessage: null,
    });
    createLoginTokenMock.mockResolvedValue({
      email: "member@example.com",
      code: "ABCDEF",
      expires: "2026-08-17T11:00:00.000Z",
    });
  });

  it("creates and activates a Career Hub guest account after payment", async () => {
    const { applyInvoicePaidFulfillment } = await import("../server/utils/order-fulfillment");
    getViewMock.mockResolvedValue({ rows: [] });
    createUserMock.mockResolvedValue({ ok: true });
    getDocumentMock
      .mockResolvedValueOnce({
        _id: "org.couchdb.user:bvguest", name: "bvguest", email: "member@example.com",
      })
      .mockResolvedValueOnce({
        _id: "settings", orderNotifications: { recipientEmail: "orders@example.com" },
      });

    await applyInvoicePaidFulfillment({
      ordersDatabase: "bv-orders",
      invoiceDoc: {
        _id: "invoice-guest", orderId: "purchase-guest", status: "paid",
        payment: { paidAt: "2026-08-17T10:00:00.000Z" },
      },
      orderDoc: {
        _id: "purchase-guest", guestEmail: "member@example.com",
        content: { product: "pow_lab_lite", checkoutType: "career_hub_guest", valid_days: 30, sats: 100 },
      },
    });

    expect(createUserMock).toHaveBeenCalledOnce();
    expect(putDocumentMock).toHaveBeenCalledWith("_users", expect.objectContaining({
      email: "member@example.com", pow_lab_lite_status: "active",
    }));
    expect(queueTemplateEmailMock).toHaveBeenCalledWith(expect.objectContaining({
      templateName: "welcome_to_pow_lab_lite", to: "member@example.com",
    }));
    expect(queueTemplateEmailMock).toHaveBeenCalledWith({
      templateName: "login",
      to: "member@example.com",
      payload: {
        user_email: "member@example.com",
        magic_link_url: expect.stringContaining("/confirm-login/member%40example.com/ABCDEF"),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores pending PoW Lab invoices on the user document when invoices are created", async () => {
    const { applyInvoiceCreatedFulfillment } = await import("../server/utils/order-fulfillment");
    getDocumentMock.mockResolvedValue({
      _id: "org.couchdb.user:alice",
      name: "alice",
      pow_lab_status: "expired",
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
      pow_lab_status: "pending_payment",
    }));
  });

  it("stores pending Pow Lab Lite invoices on the user document when invoices are created", async () => {
    const { applyInvoiceCreatedFulfillment } = await import("../server/utils/order-fulfillment");
    getDocumentMock.mockResolvedValue({
      _id: "org.couchdb.user:alice",
      name: "alice",
      pow_lab_lite_status: "expired",
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
          product: "pow_lab_lite",
        },
      },
    });

    expect(putDocumentMock).toHaveBeenCalledWith("_users", expect.objectContaining({
      _id: "org.couchdb.user:alice",
      pow_lab_lite_invoice: "lnbc123",
      pow_lab_lite_invoice_id: "inv_123",
      pow_lab_lite_order_id: "purchase_123",
      pow_lab_lite_status: "pending_payment",
    }));
  });

  it("stores pending conference submissions on the user document when invoices are created", async () => {
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
          product: "conference_submission",
        },
      },
    });

    expect(putDocumentMock).toHaveBeenCalledWith("_users", expect.objectContaining({
      _id: "org.couchdb.user:alice",
      conference_submission_invoice: "lnbc123",
      conference_submission_invoice_id: "inv_123",
      conference_submission_order_id: "purchase_123",
      conference_submission_status: "pending_payment",
    }));
  });

  it("marks PoW Lab users active and invoice docs done when invoices are paid", async () => {
    const { applyInvoicePaidFulfillment } = await import("../server/utils/order-fulfillment");
    getDocumentMock
      .mockResolvedValueOnce({
        _id: "org.couchdb.user:alice",
        name: "alice",
        email: "alice@example.com",
        pow_lab_invoice: "lnbc123",
        pow_lab_invoice_id: "inv_123",
        pow_lab_order_id: "purchase_123",
        pow_lab_status: "pending_payment",
      })
      .mockResolvedValueOnce({
        _id: "settings",
        orderNotifications: { recipientEmail: "orders@example.com" },
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

  it("queues Pow Lab customer and admin notifications after paid fulfillment", async () => {
    const { applyInvoicePaidFulfillment } = await import("../server/utils/order-fulfillment");
    getDocumentMock
      .mockResolvedValueOnce({
        _id: "org.couchdb.user:alice",
        name: "alice",
        email: "alice@example.com",
        pow_lab_status: "pending_payment",
      })
      .mockResolvedValueOnce({
        _id: "settings",
        orderNotifications: {
          recipientEmail: "orders@example.com",
        },
      });

    await applyInvoicePaidFulfillment({
      ordersDatabase: "bv--orders",
      invoiceDoc: {
        _id: "invoice-inv_123",
        _rev: "2-paid",
        userName: "alice",
        orderId: "purchase_123",
        timestamp: "2026-06-26T20:00:00.000Z",
        invoiceData: {
          invoiceId: "inv_123",
          paymentRequest: "lnbc123",
          status: "paid",
        },
      },
      orderDoc: {
        _id: "purchase_123",
        userName: "alice",
        content: {
          product: "pow_lab",
          validUntil: "2026-12-26T00:00:00.000Z",
          sats: 21000,
          referralSource: "telegram",
          telegram: "@alice",
        },
      },
    });

    expect(queueTemplateEmailMock).toHaveBeenCalledWith({
      templateName: "welcome_to_pow_lab",
      to: "alice@example.com",
      payload: {
        user_email: "alice@example.com",
        subscription_end_date: "2026-12-26T00:00:00.000Z",
      },
    });
    expect(queueTemplateEmailMock).toHaveBeenCalledWith({
      templateName: "admin_order",
      to: "orders@example.com",
      payload: {
        user_email: "alice@example.com",
        amount: 21000,
        referrer: "telegram",
        telegram: "@alice",
        timestamp: "2026-06-26T20:00:00.000Z",
      },
    });
  });

  it("marks PoW Lab Lite users active with the order validity window when invoices are paid", async () => {
    const { applyInvoicePaidFulfillment } = await import("../server/utils/order-fulfillment");
    getDocumentMock
      .mockResolvedValueOnce({
        _id: "org.couchdb.user:alice",
        name: "alice",
        email: "alice@example.com",
        pow_lab_lite_invoice: "lnbc123",
        pow_lab_lite_invoice_id: "inv_123",
        pow_lab_lite_order_id: "purchase_123",
        pow_lab_lite_status: "pending_payment",
      })
      .mockResolvedValueOnce({
        _id: "settings",
        orderNotifications: { recipientEmail: "orders@example.com" },
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

  it("queues Pow Lab Lite customer and admin notifications with the Lite product payload", async () => {
    const { applyInvoicePaidFulfillment } = await import("../server/utils/order-fulfillment");
    getDocumentMock
      .mockResolvedValueOnce({
        _id: "org.couchdb.user:alice",
        name: "alice",
        email: "alice@example.com",
        pow_lab_lite_status: "pending_payment",
      })
      .mockResolvedValueOnce({
        _id: "settings",
        orderNotifications: {
          recipientEmail: "orders@example.com",
        },
      });

    await applyInvoicePaidFulfillment({
      ordersDatabase: "bv--orders",
      invoiceDoc: {
        _id: "invoice-inv_123",
        _rev: "2-paid",
        userName: "alice",
        orderId: "purchase_123",
        timestamp: "2026-06-26T20:00:00.000Z",
        invoiceData: {
          invoiceId: "inv_123",
          paymentRequest: "lnbc123",
          status: "paid",
        },
      },
      orderDoc: {
        _id: "purchase_123",
        userName: "alice",
        content: {
          product: "pow_lab_lite",
          validUntil: "2026-12-26T00:00:00.000Z",
          sats: 10000,
          referralSource: "website",
          telegram: "@alice",
        },
      },
    });

    expect(queueTemplateEmailMock).toHaveBeenCalledWith({
      templateName: "welcome_to_pow_lab_lite",
      to: "alice@example.com",
      payload: {
        user_email: "alice@example.com",
        subscription_end_date: "2026-12-26T00:00:00.000Z",
        product: "pow_lab_lite",
      },
    });
    expect(queueTemplateEmailMock).toHaveBeenCalledWith({
      templateName: "admin_order_lite",
      to: "orders@example.com",
      payload: {
        user_email: "alice@example.com",
        amount: 10000,
        referrer: "website",
        telegram: "@alice",
        product: "pow_lab_lite",
        timestamp: "2026-06-26T20:00:00.000Z",
      },
    });
  });

  it("does not requeue a membership notification already marked as queued", async () => {
    const { applyInvoicePaidFulfillment } = await import("../server/utils/order-fulfillment");
    getDocumentMock
      .mockResolvedValueOnce({
        _id: "org.couchdb.user:alice",
        name: "alice",
        email: "alice@example.com",
      })
      .mockResolvedValueOnce({
        _id: "settings",
        orderNotifications: { recipientEmail: "orders@example.com" },
      });

    await applyInvoicePaidFulfillment({
      ordersDatabase: "bv--orders",
      invoiceDoc: {
        _id: "invoice-inv_123",
        _rev: "2-paid",
        userName: "alice",
        orderId: "purchase_123",
        fulfillment: {
          notifications: {
            customer: { status: "queued", templateName: "welcome_to_pow_lab" },
          },
        },
        invoiceData: { invoiceId: "inv_123", status: "paid" },
      },
      orderDoc: {
        _id: "purchase_123",
        userName: "alice",
        content: { product: "pow_lab", validUntil: "2026-12-26T00:00:00.000Z" },
      },
    });

    expect(queueTemplateEmailMock).toHaveBeenCalledTimes(1);
    expect(queueTemplateEmailMock).toHaveBeenCalledWith(expect.objectContaining({
      templateName: "admin_order",
    }));
  });

  it("extends memberships from the current user validity when paid orders only carry valid_days", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-30T12:00:00.000Z"));

    const { applyInvoicePaidFulfillment } = await import("../server/utils/order-fulfillment");
    getDocumentMock
      .mockResolvedValueOnce({
        _id: "org.couchdb.user:alice",
        name: "alice",
        email: "alice@example.com",
        pow_lab_invoice: "lnbc123",
        pow_lab_invoice_id: "inv_123",
        pow_lab_order_id: "purchase_123",
        pow_lab_status: "pending_payment",
        pow_lab_valid_until: "2026-12-31T00:00:00.000Z",
      })
      .mockResolvedValueOnce({
        _id: "settings",
        orderNotifications: { recipientEmail: "orders@example.com" },
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
    getDocumentMock
      .mockResolvedValueOnce({
        _id: "org.couchdb.user:alice",
        name: "alice",
        email: "alice@example.com",
        pow_lab_lite_invoice: "lnbc123",
        pow_lab_lite_invoice_id: "inv_123",
        pow_lab_lite_order_id: "purchase_123",
        pow_lab_lite_status: "pending_payment",
        pow_lab_lite_valid_until: "2026-09-30T00:00:00.000Z",
      })
      .mockResolvedValueOnce({
        _id: "settings",
        orderNotifications: { recipientEmail: "orders@example.com" },
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
    expect(queueTemplateEmailMock).not.toHaveBeenCalled();
  });
});
