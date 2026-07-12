import type { CouchDBDocument } from "#database/utils/couchdb";
import type { InvoiceResponse } from "../../types/lightning";
import { applyInvoicePaymentStatus, type NormalizedPaymentStatus } from "./payment-state";

export interface RefreshNwcInvoiceOptions {
  ordersDatabase: string
  invoiceDoc: CouchDBDocument
  getInvoiceStatus: (invoiceId: string) => Promise<InvoiceResponse>
  getDocument: (database: string, id: string) => Promise<CouchDBDocument | null>
  putDocument: (database: string, doc: CouchDBDocument) => Promise<{ rev?: string }>
  fulfillPaid: (options: { ordersDatabase: string; invoiceDoc: CouchDBDocument; orderDoc: CouchDBDocument }) => Promise<unknown>
  publish: (event: Record<string, unknown>) => void
}

const resolveInvoiceId = (doc: CouchDBDocument): string => String(doc.invoiceData?.invoiceId || doc.invoiceData?.id || doc.invoiceId || "")
const resolveAmount = (doc: CouchDBDocument): number => Number(doc.invoiceData?.amount || doc.amount || 0)
const resolveStatus = (doc: CouchDBDocument): string => String(doc.status || doc.payment?.status || doc.invoiceData?.status || "pending")

/** Verifies provider state and applies an idempotent NWC invoice transition. */
export const refreshNwcInvoice = async (options: RefreshNwcInvoiceOptions) => {
  const invoiceId = resolveInvoiceId(options.invoiceDoc)
  if (!invoiceId) throw new Error("NWC invoice document is missing an invoice id")
  console.info("[lightning][nwc] invoice lookup started", { invoiceId })
  const status = await options.getInvoiceStatus(invoiceId)
  if (status.provider !== "nwc" || status.invoiceId !== invoiceId) throw new Error("NWC invoice lookup does not match the persisted invoice")
  if (status.status === "paid" && status.amount !== resolveAmount(options.invoiceDoc)) {
    throw new Error("NWC invoice amount does not match the persisted invoice")
  }
  if (status.status === resolveStatus(options.invoiceDoc)) {
    console.info("[lightning][nwc] invoice status unchanged", { invoiceId, status: status.status })
    return { changed: false, invoiceDoc: options.invoiceDoc }
  }

  const updated = applyInvoicePaymentStatus({
    invoiceDoc: options.invoiceDoc,
    status: status.status as NormalizedPaymentStatus,
  })
  const write = await options.putDocument(options.ordersDatabase, updated)
  const persisted = { ...updated, _rev: write.rev || updated._rev }
  const orderId = typeof persisted.orderId === "string" ? persisted.orderId : ""
  console.info("[lightning][nwc] invoice transition persisted", { invoiceId, from: resolveStatus(options.invoiceDoc), to: status.status, orderId: orderId || null })
  let userName = typeof persisted.userName === "string" ? persisted.userName : ""
  if (status.status === "paid" && orderId) {
    const orderDoc = await options.getDocument(options.ordersDatabase, orderId)
    if (orderDoc) {
      userName = typeof orderDoc.userName === "string" ? orderDoc.userName : userName
      await options.fulfillPaid({ ordersDatabase: options.ordersDatabase, invoiceDoc: persisted, orderDoc })
      console.info("[lightning][nwc] paid invoice fulfilment completed", { invoiceId, orderId })
    }
  }
  options.publish({
    id: `nwc:${invoiceId}:${status.status}`,
    type: status.status === "paid" ? "invoice.paid" : `invoice.${status.status}`,
    provider: "nwc", invoiceId, orderId, userName: userName || undefined, status: status.status, createdAt: new Date().toISOString(),
  })
  console.info("[lightning][nwc] SSE payment event published", { invoiceId, status: status.status, orderId: orderId || null })
  return { changed: true, invoiceDoc: persisted }
}
