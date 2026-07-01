import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStrikeProvider } from "../providers/strike";

describe("strike provider", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("preserves the Strike webhook event id when normalizing invoice state changes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        invoiceId: "inv_123",
        state: "PAID",
        correlationId: "purchase_123",
        amount: {
          amount: "0.00000100",
          currency: "BTC",
        },
      }),
    }));

    const provider = createStrikeProvider({
      apiKey: "strike_key",
      webhookSecret: "strike_secret",
      baseUrl: "http://strike.test",
    });

    const event = await provider.processWebhook({
      id: "evt_paid_123",
      eventType: "invoice.updated",
      data: {
        entityId: "inv_123",
        changes: ["state"],
      },
      created: "2026-06-26T20:00:00.000Z",
    });

    expect(event).toEqual(expect.objectContaining({
      eventId: "evt_paid_123",
      invoiceId: "inv_123",
      status: "paid",
      metadata: expect.objectContaining({
        correlationId: "purchase_123",
      }),
    }));
  });
});
