import { describe, expect, it } from "vitest";
import {
  applyInvoicePaymentStatus,
  createInvoicePaymentState,
} from "../server/utils/payment-state";

describe("payment state", () => {
  it("creates a normalized payment state while preserving legacy invoiceData", () => {
    const invoiceDoc = createInvoicePaymentState({
      _id: "invoice-inv_123",
      invoiceData: {
        id: "inv_123",
        paymentRequest: "lnbc123",
        status: "pending",
      },
      lastEvent: "created",
    });

    expect(invoiceDoc).toMatchObject({
      payment: {
        status: "pending",
        providerInvoiceId: "inv_123",
        paymentRequest: "lnbc123",
      },
      invoiceData: {
        status: "pending",
      },
      lastEvent: "created",
    });
  });

  it("updates paid state with normalized and legacy fields during transition", () => {
    const invoiceDoc = applyInvoicePaymentStatus({
      invoiceDoc: {
        _id: "invoice-inv_123",
        invoiceData: {
          id: "inv_123",
          status: "pending",
        },
        payment: {
          status: "pending",
          providerInvoiceId: "inv_123",
          createdAt: "2026-06-26T20:00:00.000Z",
        },
        lastEvent: "created",
      },
      status: "paid",
      eventTime: "2026-06-26T20:05:00.000Z",
    });

    expect(invoiceDoc).toMatchObject({
      payment: {
        status: "paid",
        providerInvoiceId: "inv_123",
        paidAt: "2026-06-26T20:05:00.000Z",
      },
      invoiceData: {
        status: "paid",
      },
      lastEvent: "paid",
      timestampPaid: "2026-06-26T20:05:00.000Z",
    });
  });
});
