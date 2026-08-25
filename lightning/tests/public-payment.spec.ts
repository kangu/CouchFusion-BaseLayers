import { describe, expect, it } from "vitest";
import { toPublicPaymentInfo } from "../utils/public-payment";

describe("public payment serializer", () => {
  it("keeps compatible invoice and quote fields while dropping all internal context and proof", () => {
    const internal = {
      id: "a".repeat(64),
      invoiceId: "a".repeat(64),
      paymentRequest: "lnbc1public",
      amount: 21,
      currency: "sats",
      status: "pending" as const,
      expiresAt: new Date("2026-08-21T19:00:00.000Z"),
      provider: "blink_nc" as const,
      quoteId: "quote-1",
      rate: 1.25,
      sourceCurrency: "USD",
      targetCurrency: "BTC",
      sourceAmount: 2,
      targetAmount: 21,
      paymentContext: { verifyUrl: "https://lnurl.blink.sv/verify/hash" },
      payment: { proof: { preimage: "11".repeat(32) } },
    };

    const result = toPublicPaymentInfo(internal);

    expect(result).toEqual({
      id: "a".repeat(64),
      invoiceId: "a".repeat(64),
      paymentRequest: "lnbc1public",
      amount: 21,
      currency: "sats",
      status: "pending",
      expiresAt: new Date("2026-08-21T19:00:00.000Z"),
      provider: "blink_nc",
      quoteId: "quote-1",
      rate: 1.25,
      sourceCurrency: "USD",
      targetCurrency: "BTC",
      sourceAmount: 2,
      targetAmount: 21,
    });
    expect(JSON.stringify(result)).not.toContain("verify");
    expect(JSON.stringify(result)).not.toContain("preimage");
  });

  it("omits undefined optional properties instead of emitting or spreading them", () => {
    expect(toPublicPaymentInfo({
      invoiceId: "invoice-1",
      amount: 1,
      currency: "sats",
      status: "pending",
    })).toEqual({
      id: "invoice-1",
      invoiceId: "invoice-1",
      paymentRequest: "",
      amount: 1,
      currency: "sats",
      status: "pending",
      expiresAt: null,
    });
  });
});
