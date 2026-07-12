import { describe, expect, it, vi } from "vitest";

describe("NWC provider", () => {
  it("extracts a payment hash from the SDK payment_received envelope", async () => {
    const { extractNwcNotificationPaymentHash } = await import("../providers/nwc-client");
    expect(extractNwcNotificationPaymentHash({
      notification_type: "payment_received",
      notification: { payment_hash: "notification-hash" },
    })).toBe("notification-hash");
  });

  it("exposes only NWC method and notification capabilities for startup diagnostics", async () => {
    const { createNwcProvider } = await import("../providers/nwc");
    const provider = createNwcProvider({ connectionUri: "nostr+walletconnect://secret" }, {
      createInvoice: vi.fn(), lookupInvoice: vi.fn(), subscribeToPayments: vi.fn(), close: vi.fn(),
      getWalletInfo: vi.fn().mockResolvedValue({ methods: ["make_invoice", "lookup_invoice"], notifications: ["payment_received"] }),
    });

    await expect(provider.getNwcConnectionInfo()).resolves.toEqual({
      methods: ["make_invoice", "lookup_invoice"], notifications: ["payment_received"],
    });
  });

  it("converts a sats invoice request to msats at the adapter boundary", async () => {
    const createInvoice = vi.fn().mockResolvedValue({
      paymentHash: "nwc-hash-1",
      invoice: "lnbc1nwc",
      amountMsats: 21000,
      expiresAt: 1_800_000_000,
      state: "pending",
    });
    const { createNwcProvider } = await import("../providers/nwc");
    const provider = createNwcProvider({ connectionUri: "nostr+walletconnect://secret" }, {
      createInvoice,
      lookupInvoice: vi.fn(),
      subscribeToPayments: vi.fn().mockResolvedValue(() => undefined),
      close: vi.fn(),
    });

    await expect(provider.createInvoice({
      amount: 21,
      currency: "sats",
      description: "Membership",
    })).resolves.toMatchObject({
      invoiceId: "nwc-hash-1",
      paymentRequest: "lnbc1nwc",
      amount: 21,
      currency: "sats",
      status: "pending",
      provider: "nwc",
    });
    expect(createInvoice).toHaveBeenCalledWith({ amountMsats: 21000, description: "Membership" });
  });

  it("rejects non-integer or non-sats invoice amounts", async () => {
    const { createNwcProvider } = await import("../providers/nwc");
    const provider = createNwcProvider({ connectionUri: "nostr+walletconnect://secret" }, {
      createInvoice: vi.fn(),
      lookupInvoice: vi.fn(),
      subscribeToPayments: vi.fn().mockResolvedValue(() => undefined),
      close: vi.fn(),
    });

    await expect(provider.createInvoice({ amount: 1.5, currency: "sats" })).rejects.toThrow("positive integer sats");
    await expect(provider.createInvoice({ amount: 1, currency: "usd" })).rejects.toThrow("only supports sats");
  });

  it("maps a settled lookup to paid without trusting notification input", async () => {
    const { createNwcProvider } = await import("../providers/nwc");
    const provider = createNwcProvider({ connectionUri: "nostr+walletconnect://secret" }, {
      createInvoice: vi.fn(),
      lookupInvoice: vi.fn().mockResolvedValue({
        paymentHash: "nwc-hash-paid",
        invoice: "lnbc1paid",
        amountMsats: 2000,
        state: "settled",
      }),
      subscribeToPayments: vi.fn().mockResolvedValue(() => undefined),
      close: vi.fn(),
    });

    await expect(provider.getInvoiceStatus("nwc-hash-paid")).resolves.toMatchObject({
      invoiceId: "nwc-hash-paid",
      amount: 2,
      status: "paid",
      provider: "nwc",
    });
  });
});
