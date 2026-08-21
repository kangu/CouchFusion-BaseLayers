import { describe, expect, it } from "vitest";
import { isStalePendingInvoice } from "../server/utils/pending-invoice-expiration";

describe("provider-owned pending invoice expiry", () => {
  it.each([
    { payment: { provider: "nwc", status: "pending", createdAt: "2026-08-21T10:00:00.000Z" } },
    { payment: { provider: "blink_nc", status: "pending", createdAt: "2026-08-21T10:00:00.000Z" } },
    { invoiceData: { provider: "blink_nc", status: "pending" }, timestamp: "2026-08-21T10:00:00.000Z" },
  ])("does not let the generic heartbeat expire protocol-owned invoices", (invoiceDoc) => {
    expect(isStalePendingInvoice(invoiceDoc, new Date("2026-08-21T12:00:00.000Z"), 60_000)).toBe(false);
  });
});
