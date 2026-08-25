import { describe, expect, it, vi } from "vitest";
import {
  getBlinkNcPollDelay,
  loadBlinkNcReconciliationDocs,
  reconcileBlinkNcBatch,
} from "../server/utils/blink-nc-reconciliation";

describe("blink_nc reconciliation", () => {
  it("loads pending invoices and paid invoices whose fulfillment is incomplete", async () => {
    const pending = { _id: "invoice-pending", status: "pending" };
    const incompletePaid = {
      _id: "invoice-paid-incomplete",
      status: "paid",
      fulfillment: { notifications: { customer: { status: "queued" } } },
    };
    const fulfilledPaid = {
      _id: "invoice-paid-complete",
      status: "paid",
      fulfillment: { status: "fulfilled" },
    };
    const untrackedHistoricalPaid = {
      _id: "invoice-paid-without-fulfillment-state",
      status: "paid",
    };
    const getView = vi.fn()
      .mockResolvedValueOnce({ rows: [{ doc: pending }] })
      .mockResolvedValueOnce({
        rows: [{ doc: incompletePaid }, { doc: fulfilledPaid }, { doc: untrackedHistoricalPaid }],
      });

    const docs = await loadBlinkNcReconciliationDocs({
      ordersDatabase: "bv-orders",
      getView,
    });

    expect(getView).toHaveBeenNthCalledWith(1, "bv-orders", "lightning", "by_provider_and_status", {
      key: ["blink_nc", "pending"],
      include_docs: true,
    });
    expect(getView).toHaveBeenNthCalledWith(2, "bv-orders", "lightning", "by_provider_and_status", {
      key: ["blink_nc", "paid"],
      include_docs: true,
    });
    expect(docs.map((doc) => doc._id)).toEqual(["invoice-pending", "invoice-paid-incomplete"]);
  });

  it("uses adaptive pending, grace, and failure delays", () => {
    expect(getBlinkNcPollDelay({ ageMs: 60_000, phase: "pending", failures: 0 })).toBe(3_000);
    expect(getBlinkNcPollDelay({ ageMs: 180_000, phase: "pending", failures: 0 })).toBe(10_000);
    expect(getBlinkNcPollDelay({ ageMs: 0, phase: "grace", failures: 0 })).toBe(30_000);
    expect(getBlinkNcPollDelay({ ageMs: 0, phase: "pending", failures: 8 })).toBe(30_000);
  });

  it("bounds concurrency and isolates one invoice failure", async () => {
    let active = 0;
    let maximum = 0;
    const refresh = vi.fn(async (doc: any) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
      if (doc._id === "invoice-2") throw new Error("temporary");
      return { changed: false, status: "pending", invoiceDoc: doc };
    });
    const docs = [1, 2, 3, 4].map((id) => ({
      _id: `invoice-${id}`,
      timestamp: "2026-08-21T17:59:30.000Z",
      payment: { providerInvoiceId: String(id), expiresAt: "2026-08-21T19:00:00.000Z" },
    }));

    const result = await reconcileBlinkNcBatch({
      invoiceDocs: docs,
      attempts: new Map(),
      runningState: { running: false },
      maxConcurrency: 2,
      settlementGraceMs: 120_000,
      now: new Date("2026-08-21T18:00:00.000Z"),
      refresh,
      expire: vi.fn(),
    });

    expect(maximum).toBe(2);
    expect(result).toMatchObject({ checked: 4, failed: 1 });
  });

  it("performs final verification after grace and lets a valid paid proof win", async () => {
    const doc = { _id: "invoice-hash", timestamp: "2026-08-21T17:00:00.000Z", payment: { providerInvoiceId: "hash", expiresAt: "2026-08-21T18:00:00.000Z" } };
    const refresh = vi.fn(async () => ({ changed: true, status: "paid", invoiceDoc: { ...doc, status: "paid" } }));
    const expire = vi.fn();

    const result = await reconcileBlinkNcBatch({
      invoiceDocs: [doc], attempts: new Map(), runningState: { running: false }, maxConcurrency: 1,
      settlementGraceMs: 120_000, now: new Date("2026-08-21T18:03:00.000Z"), refresh, expire,
    });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(expire).not.toHaveBeenCalled();
    expect(result.paid).toBe(1);
  });

  it("expires only after the final post-grace verification remains unsettled", async () => {
    const doc = { _id: "invoice-hash", timestamp: "2026-08-21T17:00:00.000Z", payment: { providerInvoiceId: "hash", expiresAt: "2026-08-21T18:00:00.000Z" } };
    const refresh = vi.fn(async () => ({ changed: false, status: "pending", invoiceDoc: doc, reason: "proof_invalid" }));
    const expire = vi.fn(async () => ({ changed: true, status: "expired", invoiceDoc: { ...doc, status: "expired" } }));

    const result = await reconcileBlinkNcBatch({
      invoiceDocs: [doc], attempts: new Map(), runningState: { running: false }, maxConcurrency: 1,
      settlementGraceMs: 120_000, now: new Date("2026-08-21T18:03:00.000Z"), refresh, expire,
    });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(expire).toHaveBeenCalledTimes(1);
    expect(result.expired).toBe(1);
  });

  it("does not overlap batches sharing runtime state", async () => {
    const runningState = { running: true };
    const refresh = vi.fn();
    const result = await reconcileBlinkNcBatch({
      invoiceDocs: [{}], attempts: new Map(), runningState, maxConcurrency: 1,
      settlementGraceMs: 0, now: new Date(), refresh, expire: vi.fn(),
    });
    expect(result.skipped).toBe(1);
    expect(refresh).not.toHaveBeenCalled();
  });
});
