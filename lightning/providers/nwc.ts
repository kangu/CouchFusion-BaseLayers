import type { InvoiceRequest, InvoiceResponse, LightningProvider, NwcConfig } from "../types/lightning"
import { createNwcClientAdapter, type NwcClientAdapter, type NwcInvoiceRecord } from "./nwc-client"

const mapNwcStatus = (state: string): InvoiceResponse["status"] => {
  switch (state.trim().toLowerCase()) {
    case "settled": case "paid": case "complete": return "paid"
    case "expired": return "expired"
    case "cancelled": case "canceled": return "cancelled"
    case "failed": case "error": return "failed"
    default: return "pending"
  }
}

const toInvoiceResponse = (record: NwcInvoiceRecord): InvoiceResponse => {
  if (!record.paymentHash || !Number.isSafeInteger(record.amountMsats) || record.amountMsats <= 0 || record.amountMsats % 1000 !== 0) {
    throw new Error("NWC returned an invalid invoice record")
  }
  return {
    invoiceId: record.paymentHash,
    id: record.paymentHash,
    paymentRequest: record.invoice,
    amount: record.amountMsats / 1000,
    currency: "sats",
    status: mapNwcStatus(record.state),
    provider: "nwc",
    expiresAt: record.expiresAt,
    paymentContext: { connection: "nwc" },
  }
}

export const createNwcProvider = (
  config: NwcConfig,
  adapter?: NwcClientAdapter,
): LightningProvider & {
  subscribeToPayments: NwcClientAdapter["subscribeToPayments"]
  close: NwcClientAdapter["close"]
  getNwcConnectionInfo: NwcClientAdapter["getWalletInfo"]
} => {
  let adapterPromise = adapter ? Promise.resolve(adapter) : createNwcClientAdapter(config.connectionUri)
  const getAdapter = () => adapterPromise

  return {
    createInvoice: async (request: InvoiceRequest) => {
      if (request.currency.toLowerCase() !== "sats") throw new Error("NWC provider only supports sats invoices")
      if (!Number.isSafeInteger(request.amount) || request.amount <= 0) throw new Error("NWC provider requires positive integer sats")
      return toInvoiceResponse(await (await getAdapter()).createInvoice({
        amountMsats: request.amount * 1000,
        description: request.description,
      }))
    },
    getInvoiceStatus: async (invoiceId: string) => toInvoiceResponse(await (await getAdapter()).lookupInvoice(invoiceId)),
    validateWebhook: () => false,
    processWebhook: async () => null,
    subscribeToPayments: async (handler: (paymentHash: string) => void | Promise<void>) => (await getAdapter()).subscribeToPayments(handler),
    close: async () => (await getAdapter()).close(),
    getNwcConnectionInfo: async () => (await getAdapter()).getWalletInfo(),
  }
}

export { mapNwcStatus }
