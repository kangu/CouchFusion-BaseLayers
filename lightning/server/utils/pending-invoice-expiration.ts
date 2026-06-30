import type { CouchDBDocument } from "#database/utils/couchdb";
import {
  applyInvoicePaymentStatus,
  type NormalizedPaymentStatus,
} from "./payment-state";

export interface PendingInvoiceExpirationResult {
  checked: number;
  expiredInvoices: number;
  expiredOrders: number;
  skipped: number;
}

export interface PendingInvoiceExpirationOptions {
  ordersDatabase: string;
  now?: Date;
  maxPendingMs?: number;
  getPendingInvoiceDocs: () => Promise<CouchDBDocument[]>;
  getDocument: (databaseName: string, documentId: string) => Promise<CouchDBDocument | null>;
  putDocument: (databaseName: string, document: CouchDBDocument) => Promise<unknown>;
  onInvoiceExpired?: (event: {
    invoiceDoc: CouchDBDocument;
    orderDoc?: CouchDBDocument;
    eventTime: string;
  }) => void | Promise<void>;
}

const DEFAULT_MAX_PENDING_MS = 60 * 60 * 1000;
const PENDING_STATUS: NormalizedPaymentStatus = "pending";
const EXPIRED_STATUS: NormalizedPaymentStatus = "expired";

/**
 * Resolves the invoice status from normalized and legacy invoice fields.
 */
const resolveInvoiceStatus = (invoiceDoc: CouchDBDocument): string => {
  const status = invoiceDoc.status || invoiceDoc.payment?.status || invoiceDoc.invoiceData?.status;
  return typeof status === "string" ? status.trim() : "";
};

/**
 * Resolves the invoice creation timestamp from normalized and legacy invoice fields.
 */
const resolveInvoiceCreatedAt = (invoiceDoc: CouchDBDocument): string => {
  const createdAt = invoiceDoc.payment?.createdAt || invoiceDoc.createdAt || invoiceDoc.timestamp;
  return typeof createdAt === "string" ? createdAt.trim() : "";
};

/**
 * Resolves the linked purchase order document id from an invoice document.
 */
const resolveOrderId = (invoiceDoc: CouchDBDocument): string => {
  const orderId = invoiceDoc.orderId;
  return typeof orderId === "string" ? orderId.trim() : "";
};

/**
 * Marks a purchase order as expired for admin order processing and display.
 */
const applyExpiredOrderStatus = (
  orderDoc: CouchDBDocument,
  eventTime: string,
): CouchDBDocument => ({
  ...orderDoc,
  status: EXPIRED_STATUS,
  payment: {
    ...(orderDoc.payment || {}),
    status: EXPIRED_STATUS,
    expiredAt: eventTime,
  },
  expiredAt: eventTime,
  lastEvent: EXPIRED_STATUS,
});

/**
 * Checks whether a pending lightning invoice has exceeded the allowed pending window.
 */
export const isStalePendingInvoice = (
  invoiceDoc: CouchDBDocument,
  now: Date,
  maxPendingMs = DEFAULT_MAX_PENDING_MS,
): boolean => {
  if (resolveInvoiceStatus(invoiceDoc) !== PENDING_STATUS) {
    return false;
  }

  const createdAt = resolveInvoiceCreatedAt(invoiceDoc);
  if (!createdAt) {
    return false;
  }

  const createdAtTime = new Date(createdAt).getTime();
  if (Number.isNaN(createdAtTime)) {
    return false;
  }

  return now.getTime() - createdAtTime > maxPendingMs;
};

/**
 * Expires stale pending lightning invoice documents and their linked purchase orders.
 */
export const expireStalePendingInvoices = async (
  options: PendingInvoiceExpirationOptions,
): Promise<PendingInvoiceExpirationResult> => {
  const now = options.now || new Date();
  const eventTime = now.toISOString();
  const maxPendingMs = options.maxPendingMs || DEFAULT_MAX_PENDING_MS;
  const pendingInvoices = await options.getPendingInvoiceDocs();

  const result: PendingInvoiceExpirationResult = {
    checked: pendingInvoices.length,
    expiredInvoices: 0,
    expiredOrders: 0,
    skipped: 0,
  };

  for (const invoiceDoc of pendingInvoices) {
    if (!isStalePendingInvoice(invoiceDoc, now, maxPendingMs)) {
      result.skipped += 1;
      continue;
    }

    const expiredInvoiceDoc = applyInvoicePaymentStatus({
      invoiceDoc,
      status: EXPIRED_STATUS,
      eventTime,
    });

    await options.putDocument(options.ordersDatabase, expiredInvoiceDoc);
    result.expiredInvoices += 1;

    const orderId = resolveOrderId(invoiceDoc);
    if (!orderId) {
      await options.onInvoiceExpired?.({
        invoiceDoc: expiredInvoiceDoc,
        eventTime,
      });
      continue;
    }

    const orderDoc = await options.getDocument(options.ordersDatabase, orderId);
    if (!orderDoc || orderDoc.status !== PENDING_STATUS) {
      await options.onInvoiceExpired?.({
        invoiceDoc: expiredInvoiceDoc,
        eventTime,
      });
      continue;
    }

    const expiredOrderDoc = applyExpiredOrderStatus(orderDoc, eventTime);

    await options.putDocument(options.ordersDatabase, expiredOrderDoc);
    result.expiredOrders += 1;
    await options.onInvoiceExpired?.({
      invoiceDoc: expiredInvoiceDoc,
      orderDoc: expiredOrderDoc,
      eventTime,
    });
  }

  return result;
};
