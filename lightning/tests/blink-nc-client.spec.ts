import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBlinkNcClient, type BlinkNcInvoiceRecord } from "../providers/blink-nc-client";

const METADATA = '[["text/plain","membership"]]';
const PREIMAGE = "11".repeat(32);
const PAYMENT_HASH = "02d449a31fbb267c8f352e9968a79e3e5fc95c1bbeaa502fd6454ebde5a4bedc";
const DESCRIPTION_HASH = "c5d4c0521b4d85f3fbfabe2cee3a79d2f258000e9b924c75f75cec3d04e0fb99";
const MAINNET_INVOICE = "lnbc210n1p4g3y3qpp5qt2yngclhvn8ere496vk3fu78e0ujhqmh649qt7kg48tmedyhmwqhp5ch2vq5smfkzl87l6hckwuwne6te9sqqwnwfyca0htnkr6p8qlwvsxqrrsscqpjktdlzgkpn2wx8vuvkc3qf9nft9daaux2v47erudf9g7hp0cnpawjuus3dh8r5tv3ma035ct2snqml7svwf6pmdjmfp48q8tjxhs736gpunts77";
const TESTNET_INVOICE = "lntb210n1p4g3y3qpp5qt2yngclhvn8ere496vk3fu78e0ujhqmh649qt7kg48tmedyhmwqhp5ch2vq5smfkzl87l6hckwuwne6te9sqqwnwfyca0htnkr6p8qlwvsxqrrsscqpjhjmx38artltyzfnpg2su36wjqjvr92j3yf23lpd7rp58afwm69rp60c2fx95ztxkhtygvrxnvee5sstyzaqem3p264pqpqu3eal6qksqndtsmc";
const DIFFERENT_PAYMENT_HASH_INVOICE = "lnbc20u1p3y0x3hpp5743k2g0fsqqxj7n8qzuhns5gmkk4djeejk3wkp64ppevgekvc0jsdqcve5kzar2v9nr5gpqd4hkuetesp5ez2g297jduwc20t6lmqlsg3man0vf2jfd8ar9fh8fhn2g8yttfkqxqy9gcqcqzys9qrsgqrzjqtx3k77yrrav9hye7zar2rtqlfkytl094dsp0ms5majzth6gt7ca6uhdkxl983uywgqqqqlgqqqvx5qqjqrzjqd98kxkpyw0l9tyy8r8q57k7zpy9zjmh6sez752wj6gcumqnj3yxzhdsmg6qq56utgqqqqqqqqqqqeqqjq7jd56882gtxhrjm03c93aacyfy306m4fq0tskf83c0nmet8zc2lxyyg3saz8x6vwcp26xnrlagf9semau3qm2glysp7sv95693fphvsp54l567";
const NOW = new Date("2026-08-21T18:01:00.000Z");

const metadataResponse = (overrides: Record<string, unknown> = {}) => ({
  tag: "payRequest",
  callback: "https://lnurl.blink.sv/callback?tag=payRequest",
  minSendable: 21_000,
  maxSendable: 21_000,
  metadata: METADATA,
  commentAllowed: 12,
  ...overrides,
});

const jsonResponse = (body: unknown, init?: ResponseInit) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { "content-type": "application/json" },
  ...init,
});

const createClient = (
  fetchImpl: typeof fetch,
  options: { timeoutMs?: number; now?: () => Date } = {},
) => createBlinkNcClient({
  config: {
    lightningAddress: "merchant@blink.sv",
    reconcileIntervalMs: 3_000,
    settlementGraceMs: 120_000,
    maxConcurrency: 5,
  },
  fetchImpl,
  now: () => NOW,
  ...options,
});

const invoiceRecord: BlinkNcInvoiceRecord = {
  paymentHash: PAYMENT_HASH,
  bolt11: MAINNET_INVOICE,
  amountSats: 21,
  expiresAt: new Date("2026-08-21T19:00:00.000Z"),
  verifyUrl: "https://lnurl.blink.sv/verify/custom",
  lightningAddress: "merchant@blink.sv",
  metadataHash: DESCRIPTION_HASH,
};

afterEach(() => {
  vi.useRealTimers();
});

describe("Blink non-custodial LNURL client", () => {
  it("creates an exact mainnet invoice while preserving callback query parameters", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(metadataResponse()))
      .mockResolvedValueOnce(jsonResponse({
        pr: MAINNET_INVOICE,
        verify: "https://lnurl.blink.sv/verify/custom",
      }));

    const result = await createClient(fetchMock).createInvoice({
      amountSats: 21,
      description: "membership longer than allowed",
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://blink.sv/.well-known/lnurlp/merchant");
    const callback = new URL(String(fetchMock.mock.calls[1]?.[0]));
    expect(callback.origin + callback.pathname).toBe("https://lnurl.blink.sv/callback");
    expect(callback.searchParams.get("tag")).toBe("payRequest");
    expect(callback.searchParams.get("amount")).toBe("21000");
    expect(callback.searchParams.get("comment")).toBe("membership l");
    expect(result).toEqual(invoiceRecord);
  });

  it("derives the verification URL from the validated callback origin", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(metadataResponse()))
      .mockResolvedValueOnce(jsonResponse({ pr: MAINNET_INVOICE }));

    const result = await createClient(fetchMock).createInvoice({ amountSats: 21 });

    expect(result.verifyUrl).toBe(`https://lnurl.blink.sv/verify/${PAYMENT_HASH}`);
  });

  it("rejects an unsafe server-provided verification URL", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(metadataResponse()))
      .mockResolvedValueOnce(jsonResponse({
        pr: MAINNET_INVOICE,
        verify: "https://blink.sv.attacker.example/verify/private",
      }));

    await expect(createClient(fetchMock).createInvoice({ amountSats: 21 }))
      .rejects.toThrow("Blink LNURL verification host is not allowed");
  });

  it.each([
    "http://lnurl.blink.sv/callback",
    "https://user:password@lnurl.blink.sv/callback",
    "https://lnurl.blink.sv:444/callback",
    "https://127.0.0.1/callback",
    "https://169.254.169.254/callback",
    "https://blink.sv.attacker.example/callback",
  ])("rejects unsafe callback URL %s before fetching it", async (callback) => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse(metadataResponse({ callback })));

    await expect(createClient(fetchMock).createInvoice({ amountSats: 21 }))
      .rejects.toThrow("Blink LNURL callback host is not allowed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects redirects without following them", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(null, {
      status: 302,
      headers: { location: "https://attacker.example" },
    }));

    await expect(createClient(fetchMock).probeConnection()).rejects.toThrow("Blink metadata request was redirected");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ redirect: "manual" });
  });

  it("rejects responses larger than 256 KiB", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response("x".repeat(256 * 1024 + 1), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    await expect(createClient(fetchMock).probeConnection()).rejects.toThrow("Blink metadata response is too large");
  });

  it.each([
    [new Response("not-json", { status: 200 }), "Blink metadata response is not valid JSON"],
    [jsonResponse({ status: "ERROR" }, { status: 503 }), "Blink metadata request failed with HTTP 503"],
  ])("rejects malformed transport responses", async (response, message) => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(response);
    await expect(createClient(fetchMock).probeConnection()).rejects.toThrow(message);
  });

  it("aborts a stalled request at the configured timeout", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    }));
    await expect(createClient(fetchMock, { timeoutMs: 5 }).probeConnection())
      .rejects.toThrow("Blink metadata request timed out");
  });

  it.each([
    [22, MAINNET_INVOICE, "BOLT11 amount does not match requested amount"],
    [21, TESTNET_INVOICE, "BOLT11 must use Bitcoin mainnet"],
  ])("rejects an invalid BOLT11 invoice", async (amountSats, paymentRequest, message) => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(metadataResponse({ minSendable: 1_000, maxSendable: 100_000 })))
      .mockResolvedValueOnce(jsonResponse({ pr: paymentRequest }));

    await expect(createClient(fetchMock).createInvoice({ amountSats })).rejects.toThrow(message);
  });

  it("rejects a BOLT11 whose description hash does not commit to LNURL metadata", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(metadataResponse({ metadata: '[["text/plain","different"]]' })))
      .mockResolvedValueOnce(jsonResponse({ pr: MAINNET_INVOICE }));

    await expect(createClient(fetchMock).createInvoice({ amountSats: 21 }))
      .rejects.toThrow("BOLT11 description hash mismatch");
  });

  it("returns pending when LUD-21 has not settled", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({ settled: false }));
    await expect(createClient(fetchMock).verifyInvoice(invoiceRecord)).resolves.toEqual({
      state: "pending",
      invoice: invoiceRecord,
    });
  });

  it.each([
    [{ ...invoiceRecord, paymentHash: "aa".repeat(32) }, "Persisted payment hash does not match BOLT11"],
    [{ ...invoiceRecord, amountSats: 22 }, "Persisted amount does not match BOLT11"],
    [{ ...invoiceRecord, verifyUrl: "https://127.0.0.1/verify/private" }, "Blink LNURL verification host is not allowed"],
  ])("rejects tampered persisted invoice context before verification", async (invoice, message) => {
    const fetchMock = vi.fn<typeof fetch>();

    await expect(createClient(fetchMock).verifyInvoice(invoice)).rejects.toThrow(message);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts paid only when the preimage hashes to the persisted payment hash", async () => {
    expect(createHash("sha256").update(Buffer.from(PREIMAGE, "hex")).digest("hex")).toBe(PAYMENT_HASH);
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({
      settled: true,
      preimage: PREIMAGE,
      pr: DIFFERENT_PAYMENT_HASH_INVOICE,
    }));

    await expect(createClient(fetchMock).verifyInvoice(invoiceRecord)).resolves.toEqual({
      state: "paid",
      invoice: invoiceRecord,
      preimage: PREIMAGE,
    });
  });

  it("still verifies a persisted invoice after nominal expiry so the reconciler can honor settlement grace", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({
      settled: true,
      preimage: PREIMAGE,
    }));

    await expect(createClient(fetchMock, {
      now: () => new Date("2026-08-21T19:01:00.000Z"),
    }).verifyInvoice(invoiceRecord)).resolves.toMatchObject({
      state: "paid",
      preimage: PREIMAGE,
    });
  });

  it.each([
    [undefined, "missing_preimage"],
    ["not-hex", "malformed_preimage"],
    ["22".repeat(32), "preimage_hash_mismatch"],
  ])("returns proof_invalid for settled responses without a valid proof", async (preimage, reason) => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({ settled: true, preimage }));

    await expect(createClient(fetchMock).verifyInvoice(invoiceRecord)).resolves.toEqual({
      state: "proof_invalid",
      invoice: invoiceRecord,
      reason,
    });
  });

  it("keeps an explicit verification not-found response retryable", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({
      status: "ERROR",
      reason: "Not found: https://must-not-leak.example/private",
    }));

    await expect(createClient(fetchMock).verifyInvoice(invoiceRecord)).resolves.toEqual({
      state: "not_found",
      invoice: invoiceRecord,
      reason: "verification_not_found",
    });
  });
});
