import { createHash, timingSafeEqual } from "node:crypto";
import { decode } from "light-bolt11-decoder";
import type { BlinkNcConfig } from "../types/lightning";

const HTTP_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 256 * 1024;

type BlinkNcErrorCode =
  | "configuration_invalid"
  | "metadata_invalid"
  | "amount_out_of_bounds"
  | "callback_invalid"
  | "invoice_invalid"
  | "transport_unavailable";

export class BlinkNcProtocolError extends Error {
  readonly code: BlinkNcErrorCode;

  constructor(code: BlinkNcErrorCode, message: string) {
    super(message);
    this.name = "BlinkNcProtocolError";
    this.code = code;
  }
}

export interface BlinkNcInvoiceRecord {
  paymentHash: string;
  bolt11: string;
  amountSats: number;
  expiresAt: Date;
  verifyUrl: string;
  lightningAddress: string;
  metadataHash: string;
}

export interface BlinkNcVerifyInput extends BlinkNcInvoiceRecord {}

export type BlinkNcVerifyResult =
  | { state: "pending"; invoice: BlinkNcInvoiceRecord }
  | { state: "paid"; invoice: BlinkNcInvoiceRecord; preimage: string }
  | { state: "proof_invalid"; invoice: BlinkNcInvoiceRecord; reason: string }
  | { state: "not_found"; invoice: BlinkNcInvoiceRecord; reason: string };

export interface BlinkNcCreateInvoiceInput {
  amountSats: number;
  description?: string;
}

interface BlinkNcClientOptions {
  config: BlinkNcConfig;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
}

interface DecodedBolt11 {
  sections: Array<{
    name: string;
    value?: unknown;
  }>;
}

interface ValidatedInvoice {
  paymentHash: string;
  amountMsats: number;
  expiresAt: Date;
  descriptionHash?: string;
}

interface LnurlPayMetadata {
  callback: URL;
  metadata: string;
  minSendable: number;
  maxSendable: number;
  commentAllowed: number;
}

const getSection = <T>(decoded: DecodedBolt11, name: string): T | undefined =>
  decoded.sections.find((section) => section.name === name)?.value as T | undefined;

const normalizeLightningAddress = (value: string): string => {
  const match = /^([a-z0-9._+-]+)@blink\.sv$/i.exec(value.trim());
  if (!match) {
    throw new BlinkNcProtocolError(
      "configuration_invalid",
      "Blink non-custodial Lightning address must be username@blink.sv",
    );
  }
  return `${match[1].toLowerCase()}@blink.sv`;
};

const isBlinkHostname = (hostname: string): boolean => {
  const normalized = hostname.toLowerCase();
  return normalized === "blink.sv" || normalized.endsWith(".blink.sv");
};

const validateRemoteUrl = (value: string | URL, kind: "metadata" | "callback" | "verification"): URL => {
  let url: URL;
  try {
    url = value instanceof URL ? new URL(value.toString()) : new URL(value);
  } catch {
    throw new BlinkNcProtocolError(
      kind === "metadata" ? "metadata_invalid" : "callback_invalid",
      `Blink LNURL ${kind} host is not allowed`,
    );
  }

  if (
    url.protocol !== "https:"
    || !isBlinkHostname(url.hostname)
    || url.username !== ""
    || url.password !== ""
    || url.port !== ""
  ) {
    throw new BlinkNcProtocolError(
      kind === "metadata" ? "metadata_invalid" : "callback_invalid",
      `Blink LNURL ${kind} host is not allowed`,
    );
  }
  return url;
};

const readBoundedBody = async (response: Response, kind: string): Promise<string> => {
  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new BlinkNcProtocolError("transport_unavailable", `Blink ${kind} response is too large`);
    }
    chunks.push(value);
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
};

const parseSafeInteger = (value: unknown): number | null => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const parseDecodedInvoice = (
  bolt11: string,
  now: Date,
  options: { requireUnexpired?: boolean } = {},
): ValidatedInvoice => {
  let decoded: DecodedBolt11;
  try {
    decoded = decode(bolt11) as DecodedBolt11;
  } catch {
    throw new BlinkNcProtocolError("invoice_invalid", "BOLT11 invoice is invalid");
  }

  const network = getSection<{ bech32?: string }>(decoded, "coin_network");
  if (!bolt11.toLowerCase().startsWith("lnbc") || network?.bech32 !== "bc") {
    throw new BlinkNcProtocolError("invoice_invalid", "BOLT11 must use Bitcoin mainnet");
  }

  const amountText = getSection<string>(decoded, "amount");
  const amountMsats = parseSafeInteger(amountText);
  if (amountMsats === null || amountMsats <= 0) {
    throw new BlinkNcProtocolError("invoice_invalid", "BOLT11 amount is invalid");
  }

  const paymentHash = getSection<string>(decoded, "payment_hash");
  if (!paymentHash || !/^[0-9a-f]{64}$/i.test(paymentHash)) {
    throw new BlinkNcProtocolError("invoice_invalid", "BOLT11 payment hash is invalid");
  }

  const timestamp = getSection<number>(decoded, "timestamp");
  const expiry = getSection<number>(decoded, "expiry");
  if (
    timestamp === undefined
    || expiry === undefined
    || !Number.isSafeInteger(timestamp)
    || !Number.isSafeInteger(expiry)
    || expiry <= 0
  ) {
    throw new BlinkNcProtocolError("invoice_invalid", "BOLT11 expiry is invalid");
  }
  const expiresAtMs = (timestamp + expiry) * 1_000;
  if (!Number.isSafeInteger(expiresAtMs)) {
    throw new BlinkNcProtocolError("invoice_invalid", "BOLT11 expiry is invalid");
  }
  if (options.requireUnexpired && expiresAtMs <= now.getTime()) {
    throw new BlinkNcProtocolError("invoice_invalid", "BOLT11 invoice is expired");
  }

  return {
    paymentHash: paymentHash.toLowerCase(),
    amountMsats,
    expiresAt: new Date(expiresAtMs),
    descriptionHash: getSection<string>(decoded, "description_hash")?.toLowerCase(),
  };
};

export const createBlinkNcClient = ({
  config,
  fetchImpl = fetch,
  now = () => new Date(),
  timeoutMs = HTTP_TIMEOUT_MS,
}: BlinkNcClientOptions) => {
  const lightningAddress = normalizeLightningAddress(config.lightningAddress);
  const localPart = lightningAddress.slice(0, lightningAddress.indexOf("@"));

  const fetchJson = async (urlInput: string | URL, kind: "metadata" | "callback" | "verification") => {
    const url = validateRemoteUrl(urlInput, kind);
    const signal = AbortSignal.timeout(timeoutMs);
    let response: Response;
    try {
      response = await fetchImpl(url.toString(), {
        method: "GET",
        redirect: "manual",
        signal,
        headers: { Accept: "application/json" },
      });
    } catch {
      if (signal.aborted) {
        throw new BlinkNcProtocolError("transport_unavailable", `Blink ${kind} request timed out`);
      }
      throw new BlinkNcProtocolError("transport_unavailable", `Blink ${kind} request is unavailable`);
    }

    if (response.status >= 300 && response.status < 400) {
      throw new BlinkNcProtocolError("transport_unavailable", `Blink ${kind} request was redirected`);
    }
    if (!response.ok) {
      throw new BlinkNcProtocolError(
        "transport_unavailable",
        `Blink ${kind} request failed with HTTP ${response.status}`,
      );
    }

    const body = await readBoundedBody(response, kind);
    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      throw new BlinkNcProtocolError("transport_unavailable", `Blink ${kind} response is not valid JSON`);
    }
  };

  const fetchMetadata = async (): Promise<LnurlPayMetadata> => {
    const metadataUrl = validateRemoteUrl(
      `https://blink.sv/.well-known/lnurlp/${encodeURIComponent(localPart)}`,
      "metadata",
    );
    const response = await fetchJson(metadataUrl, "metadata");
    const minSendable = parseSafeInteger(response.minSendable);
    const maxSendable = parseSafeInteger(response.maxSendable);
    const commentAllowed = response.commentAllowed === undefined
      ? 0
      : parseSafeInteger(response.commentAllowed);
    if (
      response.tag !== "payRequest"
      || typeof response.metadata !== "string"
      || response.metadata.length === 0
      || typeof response.callback !== "string"
      || minSendable === null
      || maxSendable === null
      || minSendable < 0
      || maxSendable < minSendable
      || commentAllowed === null
      || commentAllowed < 0
    ) {
      throw new BlinkNcProtocolError("metadata_invalid", "Blink LNURL metadata is invalid");
    }

    return {
      callback: validateRemoteUrl(response.callback, "callback"),
      metadata: response.metadata,
      minSendable,
      maxSendable,
      commentAllowed,
    };
  };

  const createInvoice = async ({ amountSats, description }: BlinkNcCreateInvoiceInput): Promise<BlinkNcInvoiceRecord> => {
    if (!Number.isSafeInteger(amountSats) || amountSats <= 0 || !Number.isSafeInteger(amountSats * 1_000)) {
      throw new BlinkNcProtocolError("amount_out_of_bounds", "Blink invoice amount must be a positive integer number of sats");
    }
    const amountMsats = amountSats * 1_000;
    const metadata = await fetchMetadata();
    if (amountMsats < metadata.minSendable || amountMsats > metadata.maxSendable) {
      throw new BlinkNcProtocolError("amount_out_of_bounds", "Blink invoice amount is outside LNURL bounds");
    }

    const callback = new URL(metadata.callback.toString());
    callback.searchParams.set("amount", String(amountMsats));
    if (description && metadata.commentAllowed > 0) {
      callback.searchParams.set("comment", [...description].slice(0, metadata.commentAllowed).join(""));
    }
    const callbackResponse = await fetchJson(callback, "callback");
    if (callbackResponse.status === "ERROR" || typeof callbackResponse.pr !== "string" || !callbackResponse.pr) {
      throw new BlinkNcProtocolError("callback_invalid", "Blink LNURL callback did not return an invoice");
    }

    const decoded = parseDecodedInvoice(callbackResponse.pr, now(), { requireUnexpired: true });
    if (decoded.amountMsats !== amountMsats) {
      throw new BlinkNcProtocolError("invoice_invalid", "BOLT11 amount does not match requested amount");
    }
    const metadataHash = createHash("sha256").update(metadata.metadata, "utf8").digest("hex");
    if (decoded.descriptionHash !== metadataHash) {
      throw new BlinkNcProtocolError("invoice_invalid", "BOLT11 description hash mismatch");
    }

    const verifyUrl = typeof callbackResponse.verify === "string" && callbackResponse.verify
      ? validateRemoteUrl(callbackResponse.verify, "verification")
      : validateRemoteUrl(new URL(`/verify/${decoded.paymentHash}`, callback.origin), "verification");

    return {
      paymentHash: decoded.paymentHash,
      bolt11: callbackResponse.pr,
      amountSats,
      expiresAt: decoded.expiresAt,
      verifyUrl: verifyUrl.toString(),
      lightningAddress,
      metadataHash,
    };
  };

  const verifyInvoice = async (invoice: BlinkNcVerifyInput): Promise<BlinkNcVerifyResult> => {
    const decoded = parseDecodedInvoice(invoice.bolt11, now());
    if (decoded.paymentHash !== invoice.paymentHash.toLowerCase()) {
      throw new BlinkNcProtocolError("invoice_invalid", "Persisted payment hash does not match BOLT11");
    }
    if (decoded.amountMsats !== invoice.amountSats * 1_000) {
      throw new BlinkNcProtocolError("invoice_invalid", "Persisted amount does not match BOLT11");
    }
    if (decoded.expiresAt.getTime() !== invoice.expiresAt.getTime()) {
      throw new BlinkNcProtocolError("invoice_invalid", "Persisted expiry does not match BOLT11");
    }

    const response = await fetchJson(validateRemoteUrl(invoice.verifyUrl, "verification"), "verification");
    if (response.status === "ERROR") {
      return { state: "not_found", invoice, reason: "verification_not_found" };
    }
    if (response.settled !== true) {
      return { state: "pending", invoice };
    }

    if (typeof response.preimage !== "string" || response.preimage.length === 0) {
      return { state: "proof_invalid", invoice, reason: "missing_preimage" };
    }
    if (!/^[0-9a-f]{64}$/i.test(response.preimage)) {
      return { state: "proof_invalid", invoice, reason: "malformed_preimage" };
    }

    const preimage = response.preimage.toLowerCase();
    const computed = createHash("sha256").update(Buffer.from(preimage, "hex")).digest();
    const expected = Buffer.from(invoice.paymentHash, "hex");
    if (computed.length !== expected.length || !timingSafeEqual(computed, expected)) {
      return { state: "proof_invalid", invoice, reason: "preimage_hash_mismatch" };
    }

    return { state: "paid", invoice, preimage };
  };

  const probeConnection = async () => {
    const metadata = await fetchMetadata();
    return {
      minSendableMsats: metadata.minSendable,
      maxSendableMsats: metadata.maxSendable,
    };
  };

  const recoverVerifyUrl = async (paymentHash: string): Promise<string> => {
    if (!/^[0-9a-f]{64}$/i.test(paymentHash)) {
      throw new BlinkNcProtocolError("invoice_invalid", "Persisted payment hash is invalid");
    }
    const metadata = await fetchMetadata();
    return validateRemoteUrl(
      new URL(`/verify/${paymentHash.toLowerCase()}`, metadata.callback.origin),
      "verification",
    ).toString();
  };

  return {
    createInvoice,
    verifyInvoice,
    recoverVerifyUrl,
    probeConnection,
  };
};
