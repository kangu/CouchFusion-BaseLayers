import { getDocument, putDocument, type CouchDBDocument } from "#database/utils/couchdb";
import type { PaymentProvider, PaymentEventType } from "../../types/payment-events";

export type PaymentEventProcessingStatus =
  | "received"
  | "processed"
  | "ignored"
  | "failed";

export interface PaymentEventLogDocument extends CouchDBDocument {
  _id: string;
  type: "payment_event";
  provider: PaymentProvider;
  providerEventId: string;
  eventType: PaymentEventType;
  invoiceId: string;
  orderId?: string;
  userName?: string;
  receivedAt: string;
  processedAt?: string;
  processingStatus: PaymentEventProcessingStatus;
  error?: string;
}

interface BeginPaymentEventProcessingOptions {
  ordersDatabase: string;
  provider: PaymentProvider;
  providerEventId: string;
  eventType: PaymentEventType;
  invoiceId: string;
  orderId?: string;
  userName?: string;
  receivedAt?: string;
}

interface BeginPaymentEventProcessingResult {
  shouldProcess: boolean;
  eventDoc: PaymentEventLogDocument;
}

const sanitizeEventId = (value: string): string => encodeURIComponent(value.trim());

export const getPaymentEventDocId = (
  provider: PaymentProvider,
  providerEventId: string,
) => `payment-event:${provider}:${sanitizeEventId(providerEventId)}`;

/**
 * Creates or reads the provider event log document used for webhook idempotency.
 */
export const beginPaymentEventProcessing = async (
  options: BeginPaymentEventProcessingOptions,
): Promise<BeginPaymentEventProcessingResult> => {
  const eventDocId = getPaymentEventDocId(options.provider, options.providerEventId);
  const existingDoc = await getDocument<PaymentEventLogDocument>(
    options.ordersDatabase,
    eventDocId,
  );

  if (existingDoc?.processingStatus === "processed") {
    return {
      shouldProcess: false,
      eventDoc: existingDoc,
    };
  }

  if (existingDoc) {
    return {
      shouldProcess: true,
      eventDoc: existingDoc,
    };
  }

  const eventDoc: PaymentEventLogDocument = {
    _id: eventDocId,
    type: "payment_event",
    provider: options.provider,
    providerEventId: options.providerEventId,
    eventType: options.eventType,
    invoiceId: options.invoiceId,
    orderId: options.orderId,
    userName: options.userName,
    receivedAt: options.receivedAt || new Date().toISOString(),
    processingStatus: "received",
  };

  const result = await putDocument(options.ordersDatabase, eventDoc);

  return {
    shouldProcess: true,
    eventDoc: {
      ...eventDoc,
      _rev: result.rev,
    },
  };
};

/**
 * Marks a provider event log document as processed after all side effects finish.
 */
export const markPaymentEventProcessed = async (
  ordersDatabase: string,
  eventDoc: PaymentEventLogDocument,
) => {
  const processedDoc = {
    ...eventDoc,
    processingStatus: "processed" as const,
    processedAt: new Date().toISOString(),
    error: undefined,
  };
  await putDocument(ordersDatabase, processedDoc);
  return processedDoc;
};

/**
 * Records a failed provider event processing attempt for operational visibility.
 */
export const markPaymentEventFailed = async (
  ordersDatabase: string,
  eventDoc: PaymentEventLogDocument,
  error: unknown,
) => {
  const failedDoc = {
    ...eventDoc,
    processingStatus: "failed" as const,
    processedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
  };
  await putDocument(ordersDatabase, failedDoc);
  return failedDoc;
};
