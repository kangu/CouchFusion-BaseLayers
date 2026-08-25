import { describe, expect, it, vi } from "vitest";
import type { BlinkNcVerifyResult } from "../providers/blink-nc-client";
import { createBlinkNcProvider } from "../providers/blink-nc";

const paymentHash = "a".repeat(64);
const expiresAt = new Date("2026-08-21T19:00:00.000Z");
const createdRecord = {
  paymentHash,
  bolt11: "lnbc1persisted",
  amountSats: 21,
  expiresAt,
  verifyUrl: "https://lnurl.blink.sv/verify/hash",
  lightningAddress: "merchant@blink.sv",
  metadataHash: "b".repeat(64),
};

const createFakeClient = () => ({
  createInvoice: vi.fn().mockResolvedValue(createdRecord),
  verifyInvoice: vi.fn<() => Promise<BlinkNcVerifyResult>>().mockResolvedValue({
    state: "pending",
    invoice: createdRecord,
  }),
  recoverVerifyUrl: vi.fn().mockResolvedValue(createdRecord.verifyUrl),
  probeConnection: vi.fn().mockResolvedValue({ minSendableMsats: 1_000, maxSendableMsats: 1_000_000 }),
});

const config = {
  lightningAddress: "merchant@blink.sv",
  reconcileIntervalMs: 3_000,
  settlementGraceMs: 120_000,
  maxConcurrency: 5,
};

const lookupContext = {
  paymentRequest: createdRecord.bolt11,
  amount: 21,
  currency: "sats",
  expiresAt,
  paymentContext: {
    protocol: "lnurl-lud21",
    lightningAddress: config.lightningAddress,
    verifyUrl: createdRecord.verifyUrl,
    metadataHash: createdRecord.metadataHash,
  },
};

describe("blink_nc provider", () => {
  it("maps an exact sats invoice into the shared provider response", async () => {
    const client = createFakeClient();
    const provider = createBlinkNcProvider(config, client);

    await expect(provider.createInvoice({ amount: 21, currency: "sats", description: "Membership" }))
      .resolves.toEqual({
        invoiceId: paymentHash,
        id: paymentHash,
        paymentRequest: createdRecord.bolt11,
        amount: 21,
        currency: "sats",
        status: "pending",
        provider: "blink_nc",
        expiresAt,
        paymentContext: {
          protocol: "lnurl-lud21",
          lightningAddress: config.lightningAddress,
          verifyUrl: createdRecord.verifyUrl,
          metadataHash: createdRecord.metadataHash,
        },
      });
    expect(client.createInvoice).toHaveBeenCalledWith({ amountSats: 21, description: "Membership" });
  });

  it("rejects non-sats, non-integer, and unsafe millisatoshi amounts", async () => {
    const provider = createBlinkNcProvider(config, createFakeClient());

    await expect(provider.createInvoice({ amount: 21, currency: "usd" })).rejects.toThrow("only supports sats");
    await expect(provider.createInvoice({ amount: 1.5, currency: "sats" })).rejects.toThrow("positive integer sats");
    await expect(provider.createInvoice({ amount: Number.MAX_SAFE_INTEGER, currency: "sats" }))
      .rejects.toThrow("positive integer sats");
  });

  it("requires authoritative persisted context for invoice lookup", async () => {
    const provider = createBlinkNcProvider(config, createFakeClient());

    await expect(provider.getInvoiceStatus(paymentHash)).rejects.toThrow(
      "blink_nc invoice lookup requires persisted invoice context",
    );
  });

  it("maps a verified proof to paid with proof material only in internal context", async () => {
    const client = createFakeClient();
    client.verifyInvoice.mockResolvedValueOnce({
      state: "paid",
      invoice: createdRecord,
      preimage: "11".repeat(32),
    });
    const provider = createBlinkNcProvider(config, client);

    await expect(provider.getInvoiceStatus(paymentHash, lookupContext)).resolves.toMatchObject({
      invoiceId: paymentHash,
      status: "paid",
      provider: "blink_nc",
      paymentContext: {
        protocol: "lnurl-lud21",
        proofVerified: true,
        verifiedPreimage: "11".repeat(32),
      },
    });
    expect(client.verifyInvoice).toHaveBeenCalledWith(createdRecord);
  });

  it.each([
    ["proof_invalid", { proofInvalid: true, diagnostic: "preimage_hash_mismatch" }],
    ["not_found", { verificationNotFound: true, diagnostic: "verification_not_found" }],
  ] as const)("keeps %s verification results pending", async (state, diagnostic) => {
    const client = createFakeClient();
    client.verifyInvoice.mockResolvedValueOnce({
      state,
      invoice: createdRecord,
      reason: diagnostic.diagnostic,
    });
    const provider = createBlinkNcProvider(config, client);

    await expect(provider.getInvoiceStatus(paymentHash, lookupContext)).resolves.toMatchObject({
      status: "pending",
      paymentContext: diagnostic,
    });
  });

  it("recovers a missing legacy verification URL without replacing persisted invoice data", async () => {
    const client = createFakeClient();
    const provider = createBlinkNcProvider(config, client);
    const contextWithoutVerifyUrl = {
      ...lookupContext,
      paymentContext: { protocol: "lnurl-lud21", metadataHash: createdRecord.metadataHash },
    };

    await provider.getInvoiceStatus(paymentHash, contextWithoutVerifyUrl);

    expect(client.recoverVerifyUrl).toHaveBeenCalledWith(paymentHash);
    expect(client.verifyInvoice).toHaveBeenCalledWith(expect.objectContaining({
      paymentHash,
      bolt11: createdRecord.bolt11,
      verifyUrl: createdRecord.verifyUrl,
    }));
  });

  it("does not expose webhook behavior and returns only bounded probe data", async () => {
    const provider = createBlinkNcProvider(config, createFakeClient());

    expect(provider.validateWebhook("body", "signature")).toBe(false);
    await expect(provider.processWebhook({ settled: true })).resolves.toBeNull();
    await expect(provider.probeConnection()).resolves.toEqual({
      minSendableMsats: 1_000,
      maxSendableMsats: 1_000_000,
    });
  });
});
