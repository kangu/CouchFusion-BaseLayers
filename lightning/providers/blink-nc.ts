import type {
  BlinkNcConfig,
  InvoiceLookupContext,
  InvoiceRequest,
  InvoiceResponse,
  LightningProvider,
} from "../types/lightning";
import {
  createBlinkNcClient,
  type BlinkNcInvoiceRecord,
  type BlinkNcVerifyResult,
} from "./blink-nc-client";

type BlinkNcClient = Pick<
  ReturnType<typeof createBlinkNcClient>,
  "createInvoice" | "verifyInvoice" | "recoverVerifyUrl" | "probeConnection"
>;

const requireLookupRecord = async (
  config: BlinkNcConfig,
  client: BlinkNcClient,
  invoiceId: string,
  context?: InvoiceLookupContext,
): Promise<BlinkNcInvoiceRecord> => {
  const expiresAt = context?.expiresAt ? new Date(context.expiresAt) : null;
  if (
    !context?.paymentRequest
    || !Number.isSafeInteger(context.amount)
    || !context.amount
    || context.amount <= 0
    || !expiresAt
    || !Number.isFinite(expiresAt.getTime())
  ) {
    throw new Error("blink_nc invoice lookup requires persisted invoice context");
  }
  if (context.currency && context.currency.toLowerCase() !== "sats") {
    throw new Error("blink_nc persisted invoice currency must be sats");
  }

  const persistedContext = context.paymentContext || {};
  const verifyUrl = typeof persistedContext.verifyUrl === "string" && persistedContext.verifyUrl
    ? persistedContext.verifyUrl
    : await client.recoverVerifyUrl(invoiceId);

  return {
    paymentHash: invoiceId,
    bolt11: context.paymentRequest,
    amountSats: context.amount,
    expiresAt,
    verifyUrl,
    lightningAddress: typeof persistedContext.lightningAddress === "string"
      ? persistedContext.lightningAddress
      : config.lightningAddress,
    metadataHash: typeof persistedContext.metadataHash === "string"
      ? persistedContext.metadataHash
      : "",
  };
};

const toPendingResponse = (
  invoice: BlinkNcInvoiceRecord,
  paymentContext: Record<string, unknown>,
): InvoiceResponse => ({
  invoiceId: invoice.paymentHash,
  id: invoice.paymentHash,
  paymentRequest: invoice.bolt11,
  amount: invoice.amountSats,
  currency: "sats",
  status: "pending",
  provider: "blink_nc",
  expiresAt: invoice.expiresAt,
  paymentContext,
});

export const createBlinkNcProvider = (
  config: BlinkNcConfig,
  client: BlinkNcClient = createBlinkNcClient({ config }),
): LightningProvider & { probeConnection: BlinkNcClient["probeConnection"] } => ({
  createInvoice: async (request: InvoiceRequest): Promise<InvoiceResponse> => {
    if (request.currency.toLowerCase() !== "sats") {
      throw new Error("blink_nc provider only supports sats invoices");
    }
    if (
      !Number.isSafeInteger(request.amount)
      || request.amount <= 0
      || !Number.isSafeInteger(request.amount * 1_000)
    ) {
      throw new Error("blink_nc provider requires positive integer sats");
    }

    const invoice = await client.createInvoice({
      amountSats: request.amount,
      description: request.description,
    });
    return toPendingResponse(invoice, {
      protocol: "lnurl-lud21",
      lightningAddress: invoice.lightningAddress,
      verifyUrl: invoice.verifyUrl,
      metadataHash: invoice.metadataHash,
    });
  },

  getInvoiceStatus: async (
    invoiceId: string,
    context?: InvoiceLookupContext,
  ): Promise<InvoiceResponse> => {
    const invoice = await requireLookupRecord(config, client, invoiceId, context);
    const persistedContext: Record<string, unknown> = {
      ...(context?.paymentContext || {}),
      protocol: "lnurl-lud21",
      lightningAddress: invoice.lightningAddress,
      verifyUrl: invoice.verifyUrl,
      metadataHash: invoice.metadataHash,
    };
    const result: BlinkNcVerifyResult = await client.verifyInvoice(invoice);

    if (result.state === "paid") {
      return {
        ...toPendingResponse(invoice, {
          ...persistedContext,
          proofVerified: true,
          verifiedPreimage: result.preimage,
        }),
        status: "paid",
      };
    }
    if (result.state === "proof_invalid") {
      return toPendingResponse(invoice, {
        ...persistedContext,
        proofInvalid: true,
        diagnostic: result.reason,
      });
    }
    if (result.state === "not_found") {
      return toPendingResponse(invoice, {
        ...persistedContext,
        verificationNotFound: true,
        diagnostic: result.reason,
      });
    }
    return toPendingResponse(invoice, persistedContext);
  },

  validateWebhook: () => false,
  processWebhook: async () => null,
  probeConnection: () => client.probeConnection(),
});
