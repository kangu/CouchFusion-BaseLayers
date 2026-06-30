import type { CouchDBDocument } from "#database/utils/couchdb";

export type NormalizedPaymentStatus =
  | "pending"
  | "paid"
  | "expired"
  | "cancelled"
  | "failed";

interface ApplyInvoicePaymentStatusOptions {
  invoiceDoc: CouchDBDocument;
  status: NormalizedPaymentStatus;
  eventTime?: string;
}

const getNowIso = () => new Date().toISOString();

const resolveProviderInvoiceId = (invoiceDoc: CouchDBDocument): string => {
  const invoiceData = invoiceDoc?.invoiceData || {};
  return String(invoiceData.id || invoiceData.invoiceId || invoiceDoc?.payment?.providerInvoiceId || "");
};

const resolvePaymentRequest = (invoiceDoc: CouchDBDocument): string => {
  const invoiceData = invoiceDoc?.invoiceData || {};
  return String(invoiceData.paymentRequest || invoiceDoc?.payment?.paymentRequest || "");
};

const toLegacyLastEvent = (status: NormalizedPaymentStatus): string => {
  if (status === "pending") {
    return "created";
  }
  return status;
};

/**
 * Builds the status-specific transition timestamp fields for payment state updates.
 */
const buildTransitionTimestamp = (
  status: NormalizedPaymentStatus,
  eventTime: string,
): Record<string, string> => {
  if (status === "paid") {
    return { paidAt: eventTime };
  }

  if (status === "expired") {
    return { expiredAt: eventTime };
  }

  if (status === "cancelled") {
    return { cancelledAt: eventTime };
  }

  if (status === "failed") {
    return { failedAt: eventTime };
  }

  return {};
};

/**
 * Adds normalized payment state to a newly-created invoice document.
 */
export const createInvoicePaymentState = (
  invoiceDoc: CouchDBDocument,
): CouchDBDocument => {
  const createdAt = String(invoiceDoc.timestamp || getNowIso());
  const status = (invoiceDoc.invoiceData?.status || "pending") as NormalizedPaymentStatus;

  return {
    ...invoiceDoc,
    status,
    payment: {
      ...(invoiceDoc.payment || {}),
      status,
      providerInvoiceId: resolveProviderInvoiceId(invoiceDoc),
      paymentRequest: resolvePaymentRequest(invoiceDoc),
      createdAt,
    },
    invoiceData: {
      ...(invoiceDoc.invoiceData || {}),
      status,
    },
    lastEvent: invoiceDoc.lastEvent || toLegacyLastEvent(status),
  };
};

/**
 * Updates normalized payment status and transitional legacy fields together.
 */
export const applyInvoicePaymentStatus = (
  options: ApplyInvoicePaymentStatusOptions,
): CouchDBDocument => {
  const eventTime = options.eventTime || getNowIso();
  const transitionTimestamp = buildTransitionTimestamp(options.status, eventTime);
  const nextPayment = {
    ...(options.invoiceDoc.payment || {}),
    status: options.status,
    providerInvoiceId: resolveProviderInvoiceId(options.invoiceDoc),
    paymentRequest: resolvePaymentRequest(options.invoiceDoc),
    ...transitionTimestamp,
  };

  return {
    ...options.invoiceDoc,
    status: options.status,
    payment: nextPayment,
    invoiceData: {
      ...(options.invoiceDoc.invoiceData || {}),
      status: options.status,
    },
    lastEvent: toLegacyLastEvent(options.status),
    ...(options.status === "paid" ? { timestampPaid: eventTime } : {}),
    ...(options.status === "expired" ? { expiredAt: eventTime } : {}),
    ...(options.status === "cancelled" ? { cancelledAt: eventTime } : {}),
    ...(options.status === "failed" ? { failedAt: eventTime } : {}),
  };
};
