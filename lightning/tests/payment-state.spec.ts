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

  it("persists complete blink_nc lookup context in normalized server payment state", () => {
    const expiresAt = new Date("2026-08-21T19:00:00.000Z");
    const invoiceDoc = createInvoicePaymentState({
      _id: "invoice-hash",
      invoiceData: {
        id: "a".repeat(64),
        invoiceId: "a".repeat(64),
        paymentRequest: "lnbc1persisted",
        amount: 21,
        currency: "sats",
        status: "pending",
        provider: "blink_nc",
        expiresAt,
        paymentContext: {
          verifyUrl: "https://lnurl.blink.sv/verify/hash",
          metadataHash: "b".repeat(64),
        },
      },
    });

    expect(invoiceDoc.payment).toMatchObject({
      provider: "blink_nc",
      providerInvoiceId: "a".repeat(64),
      paymentRequest: "lnbc1persisted",
      amount: 21,
      currency: "sats",
      expiresAt: expiresAt.toISOString(),
      providerContext: {
        verifyUrl: "https://lnurl.blink.sv/verify/hash",
        metadataHash: "b".repeat(64),
      },
    });
  });

  it("preserves proof and provider context across status transitions", () => {
    const invoiceDoc = applyInvoicePaymentStatus({
      invoiceDoc: {
        _id: "invoice-hash",
        invoiceData: { id: "a".repeat(64), status: "paid" },
        payment: {
          status: "pending",
          provider: "blink_nc",
          providerContext: { verifyUrl: "https://lnurl.blink.sv/verify/hash" },
          proof: { algorithm: "sha256", preimage: "11".repeat(32) },
        },
      },
      status: "paid",
      eventTime: "2026-08-21T18:05:00.000Z",
    });

    expect(invoiceDoc.payment).toMatchObject({
      provider: "blink_nc",
      providerContext: { verifyUrl: "https://lnurl.blink.sv/verify/hash" },
      proof: { algorithm: "sha256", preimage: "11".repeat(32) },
    });
  });
});
