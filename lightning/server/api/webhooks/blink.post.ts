import { createError, defineEventHandler, readBody } from "h3";
import { getDocument, getView, putDocument, type CouchDBDocument } from "#database/utils/couchdb";
import { createLightningService } from "../../../services/lightning";
import type { WebhookEvent } from "../../../types/lightning";
import { paymentEventBus } from "../../utils/payment-event-bus";
import type { PaymentEvent, PaymentEventType } from "../../../types/payment-events";
import { updateLinkedInvoiceDocuments } from "#lightning/server/utils/invoice-links.mjs";
import { applyInvoicePaidFulfillment } from "../../utils/order-fulfillment";
import {
  beginPaymentEventProcessing,
  markPaymentEventFailed,
  markPaymentEventProcessed,
  type PaymentEventLogDocument,
} from "../../utils/payment-event-log";
import {
  applyInvoicePaymentStatus,
  type NormalizedPaymentStatus,
} from "../../utils/payment-state";
import { resolveLightningConfig } from "../../utils/lightning-config";

interface PaymentCompletionResult {
  invoiceDoc: CouchDBDocument;
  orderDoc: CouchDBDocument | null;
  invoiceDocId: string;
  orderDocId: string | null;
}

const toNormalizedPaymentStatus = (status: string): NormalizedPaymentStatus => {
  if (
    status === "pending" ||
    status === "paid" ||
    status === "expired" ||
    status === "cancelled" ||
    status === "failed"
  ) {
    return status;
  }

  return "pending";
};

const getWebhookTimestamp = (webhookEvent: WebhookEvent) => (
  webhookEvent.timestamp ? new Date(webhookEvent.timestamp).toISOString() : new Date().toISOString()
);

const getWebhookPaymentEventType = (webhookEvent: WebhookEvent): PaymentEventType => {
  if (webhookEvent.status === "paid") {
    return "invoice.paid";
  }
  if (webhookEvent.status === "expired") {
    return "invoice.expired";
  }
  if (webhookEvent.status === "cancelled") {
    return "invoice.cancelled";
  }
  return "invoice.created";
};

const getBlinkWebhookEventId = (body: any, webhookEvent: WebhookEvent): string => {
  const bodyWithIds = body as {
    id?: unknown;
    eventId?: unknown;
    transaction?: {
      id?: unknown;
      transactionId?: unknown;
    };
  };
  const candidates = [
    bodyWithIds.id,
    bodyWithIds.eventId,
    bodyWithIds.transaction?.id,
    bodyWithIds.transaction?.transactionId,
  ];
  const providerEventId = candidates.find(
    (candidate) => typeof candidate === "string" && candidate.trim().length > 0,
  );

  if (typeof providerEventId === "string") {
    return providerEventId.trim();
  }

  return `${webhookEvent.invoiceId}:${webhookEvent.status}`;
};

async function updateInvoiceDocument(
  databaseName: string,
  invoiceDocId: string,
  webhookEvent: WebhookEvent,
): Promise<CouchDBDocument | null> {
  const invoiceDoc = await getDocument<CouchDBDocument>(databaseName, invoiceDocId);
  if (!invoiceDoc) {
    return null;
  }

  const updatedInvoice = applyInvoicePaymentStatus({
    invoiceDoc,
    status: toNormalizedPaymentStatus(webhookEvent.status),
    eventTime: getWebhookTimestamp(webhookEvent),
  });

  const result = await putDocument(databaseName, updatedInvoice);
  return {
    ...updatedInvoice,
    _rev: result.rev,
  };
}

async function updateOrderDocument(
  databaseName: string,
  orderDocId: string,
  status: "active" | "expired",
): Promise<CouchDBDocument | null> {
  const orderDoc = await getDocument<CouchDBDocument>(databaseName, orderDocId);
  if (!orderDoc) {
    return null;
  }

  const updatedOrder = {
    ...orderDoc,
    status,
  };

  const result = await putDocument(databaseName, updatedOrder);
  return {
    ...updatedOrder,
    _rev: result.rev,
  };
}

async function processPaymentCompletion(
  webhookEvent: WebhookEvent,
  runtimeConfig: any,
): Promise<PaymentCompletionResult> {
  const ordersDatabase = `${runtimeConfig.dbLoginPrefix}-orders`;
  const invoiceDocId = `invoice-${webhookEvent.invoiceId}`;

  const invoiceDoc = await updateInvoiceDocument(
    ordersDatabase,
    invoiceDocId,
    webhookEvent,
  );
  if (!invoiceDoc) {
    throw new Error(`Invoice document not found: ${invoiceDocId}`);
  }

  const orderDocId = typeof invoiceDoc.orderId === "string" && invoiceDoc.orderId.trim()
    ? invoiceDoc.orderId.trim()
    : null;

  if (!orderDocId) {
    return {
      invoiceDoc,
      orderDoc: null,
      invoiceDocId,
      orderDocId,
    };
  }

  const orderDoc = await updateOrderDocument(
    ordersDatabase,
    orderDocId,
    "active",
  );

  if (!orderDoc) {
    console.warn("Blink webhook route skipping missing order document:", {
      invoiceId: webhookEvent.invoiceId,
      orderId: orderDocId,
      status: webhookEvent.status,
    });
    return {
      invoiceDoc,
      orderDoc: null,
      invoiceDocId,
      orderDocId,
    };
  }

  const fulfillmentResult = await applyInvoicePaidFulfillment({
    ordersDatabase,
    invoiceDoc,
    orderDoc,
  });

  return {
    invoiceDoc: fulfillmentResult.invoiceDoc || invoiceDoc,
    orderDoc,
    invoiceDocId,
    orderDocId,
  };
}

const publishPaymentCompletionEvents = (
  webhookEvent: WebhookEvent,
  providerEventId: string,
  completionResult: PaymentCompletionResult,
) => {
  const timestamp = getWebhookTimestamp(webhookEvent);
  const userName = completionResult.orderDoc?.userName || completionResult.invoiceDoc.userName;
  const orderId = completionResult.orderDoc?._id || completionResult.orderDocId || undefined;

  const baseEvent = {
    provider: "blink",
    invoiceId: webhookEvent.invoiceId,
    orderId,
    userName,
    createdAt: timestamp,
    metadata: {
      invoiceDocId: completionResult.invoiceDocId,
      orderDocId: completionResult.orderDocId,
    },
  } satisfies Partial<PaymentEvent>;

  paymentEventBus.publish({
    ...baseEvent,
    id: `blink:${providerEventId}:invoice.paid`,
    type: "invoice.paid",
    status: "paid",
  } as PaymentEvent);

  if (completionResult.orderDoc) {
    paymentEventBus.publish({
      ...baseEvent,
      id: `blink:${providerEventId}:order.fulfilled`,
      type: "order.fulfilled",
      status: "fulfilled",
    } as PaymentEvent);
  }
};

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const runtimeConfig = useRuntimeConfig();

  console.log("Blink webhook route received request:", {
    eventType: body?.eventType || null,
    paymentHash: body?.transaction?.initiationVia?.paymentHash || null,
    transactionStatus: body?.transaction?.status || null,
  });

  const lightningConfig = await resolveLightningConfig(runtimeConfig);
  const lightningService = createLightningService(lightningConfig);

  try {
    const webhookEvent = await lightningService.processWebhook(body, "blink");

    if (!webhookEvent) {
      console.log("Blink webhook route ignored event:", {
        eventType: body?.eventType || null,
        paymentHash: body?.transaction?.initiationVia?.paymentHash || null,
      });
      return {
        success: true,
        processed: false,
        message: "Event ignored",
      };
    }

    const ordersDatabase = `${runtimeConfig.dbLoginPrefix}-orders`;
    const invoiceDocId = `invoice-${webhookEvent.invoiceId}`;

    if (webhookEvent.status === "paid") {
      const providerEventId = getBlinkWebhookEventId(body, webhookEvent);
      const eventType = getWebhookPaymentEventType(webhookEvent);
      let paymentEventDoc: PaymentEventLogDocument | null = null;

      try {
        const processingState = await beginPaymentEventProcessing({
          ordersDatabase,
          provider: "blink",
          providerEventId,
          eventType,
          invoiceId: webhookEvent.invoiceId,
          receivedAt: getWebhookTimestamp(webhookEvent),
        });

        paymentEventDoc = processingState.eventDoc;
        if (!processingState.shouldProcess) {
          console.log("Blink webhook route duplicate provider event skipped:", {
            providerEventId,
            invoiceId: webhookEvent.invoiceId,
          });
          return {
            success: true,
            processed: true,
            duplicate: true,
            invoiceId: webhookEvent.invoiceId,
            status: webhookEvent.status,
          };
        }

        const completionResult = await processPaymentCompletion(webhookEvent, runtimeConfig);
        const linkedUpdates = await updateLinkedInvoiceDocuments({
          registryDatabaseName: ordersDatabase,
          webhookEvent,
          getView,
          getDocument,
          putDocument,
        });
        console.log("Blink webhook route linked invoice updates:", linkedUpdates);

        publishPaymentCompletionEvents(webhookEvent, providerEventId, completionResult);
        await markPaymentEventProcessed(ordersDatabase, {
          ...paymentEventDoc,
          orderId: completionResult.orderDocId || undefined,
          userName: completionResult.orderDoc?.userName || completionResult.invoiceDoc.userName,
        });

        console.log("Blink webhook route paid invoice processed successfully:", {
          invoiceId: webhookEvent.invoiceId,
          orderId: completionResult.orderDocId,
          linkedUpdates: linkedUpdates.updated,
        });
      } catch (processingError) {
        console.error("Blink webhook route paid invoice processing failed:", processingError);
        if (paymentEventDoc) {
          await markPaymentEventFailed(ordersDatabase, paymentEventDoc, processingError);
        }
        console.log("Blink webhook route will return success despite paid processing error to avoid retries");
      }

      const responsePayload = {
        success: true,
        processed: true,
        invoiceId: webhookEvent.invoiceId,
        status: webhookEvent.status,
      };
      console.log("Blink webhook route returning success response:", responsePayload);
      return responsePayload;
    }

    console.log("Blink webhook route processing event:", {
      invoiceId: webhookEvent.invoiceId,
      status: webhookEvent.status,
      ordersDatabase,
      invoiceDocId,
    });
    const invoiceDoc = await updateInvoiceDocument(
      ordersDatabase,
      invoiceDocId,
      webhookEvent,
    );
    if (invoiceDoc) {
      console.log("Blink webhook route invoice updated:", {
        invoiceId: webhookEvent.invoiceId,
        invoiceDocId,
        orderId: invoiceDoc.orderId || null,
        status: webhookEvent.status,
      });
    } else {
      console.log("Blink webhook route found no legacy order invoice document:", {
        invoiceId: webhookEvent.invoiceId,
        invoiceDocId,
      });
    }

    const linkedUpdates = await updateLinkedInvoiceDocuments({
      registryDatabaseName: ordersDatabase,
      webhookEvent,
      getView,
      getDocument,
      putDocument,
    });
    console.log("Blink webhook route linked invoice updates:", linkedUpdates);

    if (webhookEvent.status === "expired" && invoiceDoc?.orderId) {
      console.log("Blink webhook route updating order:", {
        orderId: invoiceDoc.orderId,
        status: "expired",
      });
      const updatedOrder = await updateOrderDocument(
        ordersDatabase,
        invoiceDoc.orderId,
        "expired",
      );
      if (!updatedOrder) {
        console.warn("Blink webhook route skipping missing order document:", {
          invoiceId: webhookEvent.invoiceId,
          orderId: invoiceDoc.orderId,
          status: webhookEvent.status,
        });
      }
    }

    console.log("Blink webhook route processed successfully:", {
      invoiceId: webhookEvent.invoiceId,
      status: webhookEvent.status,
      orderId: invoiceDoc?.orderId || null,
      linkedUpdates: linkedUpdates.updated,
    });

    const responsePayload = {
      success: true,
      processed: true,
      invoiceId: webhookEvent.invoiceId,
      status: webhookEvent.status,
    };
    console.log("Blink webhook route returning success response:", responsePayload);
    return responsePayload;
  } catch (error: any) {
    console.error("Blink webhook processing error:", error);

    throw createError({
      statusCode: 500,
      statusMessage: error?.message || "Error processing Blink webhook",
    });
  }
});
