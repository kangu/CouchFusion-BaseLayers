import { createHash, timingSafeEqual } from "node:crypto";
import type { CouchDBDocument } from "#database/utils/couchdb";
import type { InvoiceLookupContext, InvoiceResponse, LightningInvoiceStatus } from "../../types/lightning";
import { applyInvoicePaymentStatus } from "./payment-state";

export interface BlinkNcRefreshResult {
  changed: boolean;
  status: LightningInvoiceStatus;
  invoiceDoc: CouchDBDocument;
  reason?: "unchanged" | "proof_invalid" | "already_processed";
}

interface RefreshOptions {
  ordersDatabase: string;
  invoiceDoc: CouchDBDocument;
  getInvoiceStatus: (invoiceId: string, context: InvoiceLookupContext) => Promise<InvoiceResponse>;
  getDocument: (database: string, id: string) => Promise<CouchDBDocument | null>;
  putDocument: (database: string, doc: CouchDBDocument) => Promise<{ rev?: string }>;
  beginEvent: (options: Record<string, unknown>) => Promise<{ shouldProcess: boolean; eventDoc: any }>;
  markEventProcessed: (database: string, eventDoc: any) => Promise<unknown>;
  markEventFailed: (database: string, eventDoc: any, error: unknown) => Promise<unknown>;
  updateLinks: (options: Record<string, unknown>) => Promise<unknown>;
  fulfillPaid: (options: { ordersDatabase: string; invoiceDoc: CouchDBDocument; orderDoc: CouchDBDocument }) => Promise<unknown>;
  publish: (event: any) => void;
  now?: () => Date;
}

const text = (value: unknown): string => typeof value === "string" ? value.trim() : "";
const statusOf = (doc: CouchDBDocument): LightningInvoiceStatus =>
  text(doc.status || doc.payment?.status || doc.invoiceData?.status || "pending") as LightningInvoiceStatus;

const extractPersisted = (doc: CouchDBDocument) => {
  const provider = text(doc.payment?.provider || doc.invoiceData?.provider || doc.provider);
  const invoiceId = text(doc.payment?.providerInvoiceId || doc.invoiceData?.invoiceId || doc.invoiceData?.id);
  const paymentRequest = text(doc.payment?.paymentRequest || doc.invoiceData?.paymentRequest);
  const amount = Number(doc.payment?.amount ?? doc.invoiceData?.amount ?? doc.amount);
  const currency = text(doc.payment?.currency || doc.invoiceData?.currency || "sats");
  const expiresAt = text(doc.payment?.expiresAt || doc.invoiceData?.expiresAt);
  const providerContext = doc.payment?.providerContext && typeof doc.payment.providerContext === "object"
    ? { ...doc.payment.providerContext }
    : doc.invoiceData?.paymentContext && typeof doc.invoiceData.paymentContext === "object"
      ? { ...doc.invoiceData.paymentContext }
      : {};
  if (
    doc.type !== "lightning_invoice"
    || provider !== "blink_nc"
    || !/^[0-9a-f]{64}$/i.test(invoiceId)
    || !paymentRequest
    || !Number.isSafeInteger(amount)
    || amount <= 0
    || currency.toLowerCase() !== "sats"
    || !expiresAt
    || Number.isNaN(new Date(expiresAt).getTime())
  ) {
    throw new Error(`Invalid persisted blink_nc invoice ${text(doc._id) || invoiceId}`);
  }
  return { invoiceId: invoiceId.toLowerCase(), paymentRequest, amount, currency: "sats", expiresAt, providerContext };
};

const isConflict = (error: unknown): boolean =>
  Boolean((error as any)?.statusCode === 409 || (error as any)?.status === 409 || (error as any)?.error === "conflict");

const persistWithRetry = async (
  options: RefreshOptions,
  build: (current: CouchDBDocument) => CouchDBDocument,
): Promise<{ doc: CouchDBDocument; changed: boolean }> => {
  let current = await options.getDocument(options.ordersDatabase, text(options.invoiceDoc._id));
  if (!current) throw new Error("Persisted blink_nc invoice document was not found");

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const currentStatus = statusOf(current);
    if (["cancelled", "expired"].includes(currentStatus)) return { doc: current, changed: false };
    const next = build(current);
    if (next === current) return { doc: current, changed: false };
    try {
      const write = await options.putDocument(options.ordersDatabase, next);
      return { doc: { ...next, _rev: write.rev || next._rev }, changed: true };
    } catch (error) {
      if (!isConflict(error) || attempt === 2) throw error;
      const reloaded = await options.getDocument(options.ordersDatabase, text(options.invoiceDoc._id));
      if (!reloaded) throw error;
      current = reloaded;
    }
  }
  throw new Error("Unreachable blink_nc persistence retry state");
};

const eventBase = (invoiceId: string, status: "paid" | "expired", doc: CouchDBDocument, eventTime: string) => ({
  id: `blink_nc:${invoiceId}:${status}`,
  type: `invoice.${status}`,
  provider: "blink_nc" as const,
  invoiceId,
  orderId: text(doc.orderId) || undefined,
  userName: text(doc.userName) || undefined,
  status,
  createdAt: eventTime,
});

export const refreshBlinkNcInvoice = async (options: RefreshOptions): Promise<BlinkNcRefreshResult> => {
  const persisted = extractPersisted(options.invoiceDoc);
  const lookup = await options.getInvoiceStatus(persisted.invoiceId, {
    paymentRequest: persisted.paymentRequest,
    amount: persisted.amount,
    currency: persisted.currency,
    expiresAt: persisted.expiresAt,
    paymentContext: persisted.providerContext,
  });
  if (lookup.provider !== "blink_nc" || lookup.invoiceId !== persisted.invoiceId || lookup.amount !== persisted.amount) {
    throw new Error("blink_nc lookup does not match persisted invoice");
  }
  if (lookup.status !== "paid") {
    return {
      changed: false,
      status: statusOf(options.invoiceDoc),
      invoiceDoc: options.invoiceDoc,
      reason: lookup.paymentContext?.proofInvalid === true ? "proof_invalid" : "unchanged",
    };
  }

  const preimage = text(lookup.paymentContext?.verifiedPreimage).toLowerCase();
  if (lookup.paymentContext?.proofVerified !== true || !/^[0-9a-f]{64}$/.test(preimage)) {
    throw new Error("blink_nc paid response is missing verified proof");
  }
  const computed = createHash("sha256").update(Buffer.from(preimage, "hex")).digest();
  const expected = Buffer.from(persisted.invoiceId, "hex");
  if (computed.length !== expected.length || !timingSafeEqual(computed, expected)) {
    throw new Error("blink_nc proof does not match persisted payment hash");
  }

  const eventTime = (options.now?.() || new Date()).toISOString();
  const processing = await options.beginEvent({
    ordersDatabase: options.ordersDatabase,
    provider: "blink_nc",
    providerEventId: `blink_nc:${persisted.invoiceId}:paid`,
    eventType: "invoice.paid",
    invoiceId: persisted.invoiceId,
    orderId: text(options.invoiceDoc.orderId) || undefined,
    userName: text(options.invoiceDoc.userName) || undefined,
    receivedAt: eventTime,
  });
  if (!processing.shouldProcess) {
    return { changed: false, status: "paid", invoiceDoc: options.invoiceDoc, reason: "already_processed" };
  }

  try {
    const persistedWrite = await persistWithRetry(options, (current) => {
      const currentStatus = statusOf(current);
      if (currentStatus === "paid") return current;
      if (currentStatus !== "pending") return current;
      const paid = applyInvoicePaymentStatus({ invoiceDoc: current, status: "paid", eventTime });
      return {
        ...paid,
        payment: {
          ...(paid.payment || {}),
          proof: { algorithm: "sha256", preimage, verifiedAt: eventTime },
        },
      };
    });
    const finalStatus = statusOf(persistedWrite.doc);
    if (finalStatus !== "paid") {
      return { changed: false, status: finalStatus, invoiceDoc: persistedWrite.doc };
    }

    await options.updateLinks({
      registryDatabaseName: options.ordersDatabase,
      webhookEvent: { invoiceId: persisted.invoiceId, status: "paid", timestamp: new Date(eventTime) },
    });
    const orderId = text(persistedWrite.doc.orderId);
    let fulfilled = false;
    if (orderId) {
      const orderDoc = await options.getDocument(options.ordersDatabase, orderId);
      if (orderDoc) {
        await options.fulfillPaid({ ordersDatabase: options.ordersDatabase, invoiceDoc: persistedWrite.doc, orderDoc });
        fulfilled = true;
      }
    }
    options.publish(eventBase(persisted.invoiceId, "paid", persistedWrite.doc, eventTime));
    if (fulfilled) {
      options.publish({ ...eventBase(persisted.invoiceId, "paid", persistedWrite.doc, eventTime), id: `blink_nc:${persisted.invoiceId}:fulfilled`, type: "order.fulfilled", status: "fulfilled" });
    }
    await options.markEventProcessed(options.ordersDatabase, processing.eventDoc);
    return { changed: persistedWrite.changed, status: "paid", invoiceDoc: persistedWrite.doc };
  } catch (error) {
    await options.markEventFailed(options.ordersDatabase, processing.eventDoc, error);
    throw error;
  }
};

export const expireUnsettledBlinkNcInvoice = async (options: RefreshOptions): Promise<BlinkNcRefreshResult> => {
  const persisted = extractPersisted(options.invoiceDoc);
  const current = await options.getDocument(options.ordersDatabase, text(options.invoiceDoc._id)) || options.invoiceDoc;
  const currentStatus = statusOf(current);
  if (currentStatus !== "pending") return { changed: false, status: currentStatus, invoiceDoc: current };
  const eventTime = (options.now?.() || new Date()).toISOString();
  const processing = await options.beginEvent({
    ordersDatabase: options.ordersDatabase,
    provider: "blink_nc",
    providerEventId: `blink_nc:${persisted.invoiceId}:expired`,
    eventType: "invoice.expired",
    invoiceId: persisted.invoiceId,
    receivedAt: eventTime,
  });
  if (!processing.shouldProcess) return { changed: false, status: "expired", invoiceDoc: current, reason: "already_processed" };
  try {
    const write = await persistWithRetry({ ...options, invoiceDoc: current }, (latest) =>
      statusOf(latest) === "pending"
        ? applyInvoicePaymentStatus({ invoiceDoc: latest, status: "expired", eventTime })
        : latest);
    if (statusOf(write.doc) === "expired" && write.changed) {
      options.publish(eventBase(persisted.invoiceId, "expired", write.doc, eventTime));
    }
    await options.markEventProcessed(options.ordersDatabase, processing.eventDoc);
    return { changed: write.changed, status: statusOf(write.doc), invoiceDoc: write.doc };
  } catch (error) {
    await options.markEventFailed(options.ordersDatabase, processing.eventDoc, error);
    throw error;
  }
};
