import { beforeEach, describe, expect, it, vi } from "vitest";

const getDocumentMock = vi.fn();
const putDocumentMock = vi.fn();

vi.mock("#database/utils/couchdb", () => ({
  getDocument: getDocumentMock,
  putDocument: putDocumentMock,
}));

describe("payment event log", () => {
  beforeEach(() => {
    getDocumentMock.mockReset();
    putDocumentMock.mockReset();
    putDocumentMock.mockResolvedValue({ ok: true, id: "updated", rev: "2-updated" });
  });

  it("creates a received event doc for new provider events", async () => {
    const { beginPaymentEventProcessing } = await import("../server/utils/payment-event-log");
    getDocumentMock.mockResolvedValue(null);

    const result = await beginPaymentEventProcessing({
      ordersDatabase: "bv--orders",
      provider: "strike",
      providerEventId: "evt_123",
      eventType: "invoice.paid",
      invoiceId: "inv_123",
      orderId: "purchase_123",
      receivedAt: "2026-06-26T20:00:00.000Z",
    });

    expect(result.shouldProcess).toBe(true);
    expect(result.eventDoc._id).toBe("payment-event:strike:evt_123");
    expect(putDocumentMock).toHaveBeenCalledWith("bv--orders", expect.objectContaining({
      _id: "payment-event:strike:evt_123",
      type: "payment_event",
      processingStatus: "received",
      invoiceId: "inv_123",
      orderId: "purchase_123",
    }));
  });

  it("skips provider events that were already processed", async () => {
    const { beginPaymentEventProcessing } = await import("../server/utils/payment-event-log");
    getDocumentMock.mockResolvedValue({
      _id: "payment-event:strike:evt_123",
      type: "payment_event",
      processingStatus: "processed",
      invoiceId: "inv_123",
    });

    const result = await beginPaymentEventProcessing({
      ordersDatabase: "bv--orders",
      provider: "strike",
      providerEventId: "evt_123",
      eventType: "invoice.paid",
      invoiceId: "inv_123",
      receivedAt: "2026-06-26T20:00:00.000Z",
    });

    expect(result.shouldProcess).toBe(false);
    expect(putDocumentMock).not.toHaveBeenCalled();
  });
});
