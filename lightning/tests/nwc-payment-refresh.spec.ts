import { describe, expect, it, vi } from "vitest";

describe("NWC invoice refresh", () => {
  it("persists a verified paid status once and runs paid fulfilment", async () => {
    const invoiceDoc = {
      _id: "invoice-hash-1", _rev: "1-a", type: "lightning_invoice", orderId: "order-1",
      invoiceData: { invoiceId: "hash-1", provider: "nwc", amount: 21, status: "pending" },
    } as any;
    const putDocument = vi.fn().mockResolvedValue({ rev: "2-b" });
    const fulfillPaid = vi.fn().mockResolvedValue({});
    const { refreshNwcInvoice } = await import("../server/utils/nwc-payment-refresh");

    const publish = vi.fn();
    const result = await refreshNwcInvoice({
      ordersDatabase: "app-orders", invoiceDoc,
      getInvoiceStatus: vi.fn().mockResolvedValue({ invoiceId: "hash-1", amount: 21, status: "paid", provider: "nwc" }),
      getDocument: vi.fn().mockResolvedValue({ _id: "order-1", userName: "member", content: { product: "unknown" } }),
      putDocument, fulfillPaid, publish,
    });

    expect(result.changed).toBe(true);
    expect(putDocument).toHaveBeenCalledWith("app-orders", expect.objectContaining({ status: "paid" }));
    expect(fulfillPaid).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({
      type: "invoice.paid", invoiceId: "hash-1", orderId: "order-1", userName: "member",
    }));
  });

  it("rejects a paid response whose amount differs from the persisted invoice", async () => {
    const { refreshNwcInvoice } = await import("../server/utils/nwc-payment-refresh");
    await expect(refreshNwcInvoice({
      ordersDatabase: "app-orders",
      invoiceDoc: { _id: "invoice-hash-1", type: "lightning_invoice", invoiceData: { invoiceId: "hash-1", provider: "nwc", amount: 21, status: "pending" } } as any,
      getInvoiceStatus: vi.fn().mockResolvedValue({ invoiceId: "hash-1", amount: 22, status: "paid", provider: "nwc" }),
      getDocument: vi.fn(), putDocument: vi.fn(), fulfillPaid: vi.fn(), publish: vi.fn(),
    })).rejects.toThrow("amount does not match");
  });
});
