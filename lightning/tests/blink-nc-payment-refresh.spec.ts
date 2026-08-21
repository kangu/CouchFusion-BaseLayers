import { describe, expect, it, vi } from "vitest";
import { expireUnsettledBlinkNcInvoice, refreshBlinkNcInvoice } from "../server/utils/blink-nc-payment-refresh";

const PREIMAGE = "11".repeat(32);
const PAYMENT_HASH = "02d449a31fbb267c8f352e9968a79e3e5fc95c1bbeaa502fd6454ebde5a4bedc";
const EVENT_TIME = "2026-08-21T19:01:00.000Z";

const invoiceFixture = () => ({
  _id: `invoice-${PAYMENT_HASH}`,
  _rev: "1-invoice",
  type: "lightning_invoice",
  orderId: "purchase-1",
  userName: "alice",
  status: "pending",
  invoiceData: {
    id: PAYMENT_HASH,
    invoiceId: PAYMENT_HASH,
    paymentRequest: "lnbc1persisted",
    amount: 21,
    currency: "sats",
    status: "pending",
    provider: "blink_nc",
    expiresAt: "2026-08-21T19:00:00.000Z",
  },
  payment: {
    provider: "blink_nc",
    providerInvoiceId: PAYMENT_HASH,
    paymentRequest: "lnbc1persisted",
    amount: 21,
    currency: "sats",
    status: "pending",
    expiresAt: "2026-08-21T19:00:00.000Z",
    providerContext: { verifyUrl: `https://lnurl.blink.sv/verify/${PAYMENT_HASH}` },
  },
});

const dependencies = (overrides: Record<string, unknown> = {}) => {
  let currentInvoice: any = invoiceFixture();
  const order = { _id: "purchase-1", status: "pending", userName: "alice", content: { product: "pow_lab" } };
  const putDocument = vi.fn(async (_database: string, doc: any) => {
    if (doc._id === currentInvoice._id) currentInvoice = { ...doc, _rev: "2-invoice" };
    return { ok: true, id: doc._id, rev: doc._rev || "2-test" };
  });
  const eventDoc = { _id: "payment-event-1", _rev: "1-event", processingStatus: "received" };
  return {
    ordersDatabase: "bv-orders",
    invoiceDoc: currentInvoice,
    getInvoiceStatus: vi.fn(async () => ({
      invoiceId: PAYMENT_HASH,
      id: PAYMENT_HASH,
      paymentRequest: "lnbc1persisted",
      amount: 21,
      currency: "sats",
      status: "paid",
      provider: "blink_nc",
      expiresAt: new Date("2026-08-21T19:00:00.000Z"),
      paymentContext: { proofVerified: true, verifiedPreimage: PREIMAGE },
    })),
    getDocument: vi.fn(async (_database: string, id: string) => id === currentInvoice._id ? currentInvoice : id === order._id ? order : null),
    putDocument,
    beginEvent: vi.fn(async () => ({ shouldProcess: true, eventDoc })),
    markEventProcessed: vi.fn(async () => ({ ...eventDoc, processingStatus: "processed" })),
    markEventFailed: vi.fn(async () => ({ ...eventDoc, processingStatus: "failed" })),
    updateLinks: vi.fn(async () => ({ updated: 1, skipped: 0 })),
    fulfillPaid: vi.fn(async () => ({ applied: true })),
    publish: vi.fn(),
    now: () => new Date(EVENT_TIME),
    ...overrides,
  } as any;
};

describe("strict blink_nc payment refresh", () => {
  it("persists a cryptographically verified proof and completes existing side effects once", async () => {
    const options = dependencies();

    const result = await refreshBlinkNcInvoice(options);

    expect(result).toMatchObject({ changed: true, status: "paid" });
    expect(options.putDocument).toHaveBeenCalledWith("bv-orders", expect.objectContaining({
      status: "paid",
      payment: expect.objectContaining({
        status: "paid",
        proof: { algorithm: "sha256", preimage: PREIMAGE, verifiedAt: EVENT_TIME },
      }),
    }));
    expect(options.updateLinks).toHaveBeenCalledTimes(1);
    expect(options.fulfillPaid).toHaveBeenCalledTimes(1);
    expect(options.publish).toHaveBeenCalledWith(expect.objectContaining({ type: "invoice.paid", provider: "blink_nc" }));
    expect(options.publish).toHaveBeenCalledWith(expect.objectContaining({ type: "order.fulfilled", provider: "blink_nc" }));
    expect(options.markEventProcessed).toHaveBeenCalledTimes(1);
  });

  it("leaves proof-invalid settlement pending with no mutation or side effect", async () => {
    const options = dependencies({
      getInvoiceStatus: vi.fn(async () => ({
        invoiceId: PAYMENT_HASH, amount: 21, currency: "sats", status: "pending", provider: "blink_nc",
        paymentContext: { proofInvalid: true, diagnostic: "preimage_hash_mismatch" },
      })),
    });

    await expect(refreshBlinkNcInvoice(options)).resolves.toMatchObject({
      changed: false,
      status: "pending",
      reason: "proof_invalid",
    });
    expect(options.putDocument).not.toHaveBeenCalled();
    expect(options.fulfillPaid).not.toHaveBeenCalled();
    expect(options.publish).not.toHaveBeenCalled();
  });

  it("rejects a paid response whose preimage does not match the persisted hash", async () => {
    const options = dependencies();
    options.getInvoiceStatus.mockResolvedValueOnce({
      invoiceId: PAYMENT_HASH, amount: 21, currency: "sats", status: "paid", provider: "blink_nc",
      paymentContext: { proofVerified: true, verifiedPreimage: "22".repeat(32) },
    });

    await expect(refreshBlinkNcInvoice(options)).rejects.toThrow("blink_nc proof does not match persisted payment hash");
    expect(options.putDocument).not.toHaveBeenCalled();
  });

  it("does not repeat a processed provider event", async () => {
    const options = dependencies({
      beginEvent: vi.fn(async () => ({ shouldProcess: false, eventDoc: { processingStatus: "processed" } })),
    });

    await expect(refreshBlinkNcInvoice(options)).resolves.toMatchObject({ changed: false, reason: "already_processed" });
    expect(options.putDocument).not.toHaveBeenCalled();
    expect(options.fulfillPaid).not.toHaveBeenCalled();
  });

  it("lets a concurrent cancellation win over a pending refresh", async () => {
    const cancelled = { ...invoiceFixture(), status: "cancelled", payment: { ...invoiceFixture().payment, status: "cancelled" } };
    const options = dependencies({ getDocument: vi.fn(async () => cancelled) });

    await expect(refreshBlinkNcInvoice(options)).resolves.toMatchObject({ changed: false, status: "cancelled" });
    expect(options.putDocument).not.toHaveBeenCalled();
  });

  it("bounds persistent CouchDB revision conflicts to three writes", async () => {
    const conflict = Object.assign(new Error("conflict"), { statusCode: 409 });
    const putDocument = vi.fn().mockRejectedValue(conflict);
    const options = dependencies({ putDocument });

    await expect(refreshBlinkNcInvoice(options)).rejects.toThrow("conflict");
    expect(putDocument).toHaveBeenCalledTimes(3);
    expect(options.markEventFailed).toHaveBeenCalledTimes(1);
  });

  it("expires an unsettled post-grace invoice idempotently through the event boundary", async () => {
    const options = dependencies();
    const first = await expireUnsettledBlinkNcInvoice(options);
    expect(first).toMatchObject({ changed: true, status: "expired" });
    expect(options.publish).toHaveBeenCalledWith(expect.objectContaining({ type: "invoice.expired" }));

    options.invoiceDoc = first.invoiceDoc;
    options.getDocument.mockResolvedValue(first.invoiceDoc);
    const second = await expireUnsettledBlinkNcInvoice(options);
    expect(second).toMatchObject({ changed: false, status: "expired" });
  });
});
