import { createError, defineEventHandler, readBody } from "h3";
import { getDocument, putDocument, type CouchDBDocument } from "#database/utils/couchdb";
import { createLightningService } from "../../../services/lightning";
import type { LightningConfig, WebhookEvent } from "../../../types/lightning";

async function updateInvoiceDocument(
  databaseName: string,
  invoiceDocId: string,
  webhookEvent: WebhookEvent,
) {
  const invoiceDoc = await getDocument<CouchDBDocument>(databaseName, invoiceDocId);
  if (!invoiceDoc) {
    throw new Error(`Invoice document not found: ${invoiceDocId}`);
  }

  const updatedInvoice = {
    ...invoiceDoc,
    lastEvent: webhookEvent.status,
    invoiceData: {
      ...invoiceDoc.invoiceData,
      status: webhookEvent.status,
    },
    timestampPaid:
      webhookEvent.status === "paid" ? new Date().toISOString() : invoiceDoc.timestampPaid,
  };

  await putDocument(databaseName, updatedInvoice);
  return invoiceDoc;
}

async function updateOrderDocument(
  databaseName: string,
  orderDocId: string,
  status: "active" | "expired",
) {
  const orderDoc = await getDocument<CouchDBDocument>(databaseName, orderDocId);
  if (!orderDoc) {
    throw new Error(`Order document not found: ${orderDocId}`);
  }

  const updatedOrder = {
    ...orderDoc,
    status,
  };

  await putDocument(databaseName, updatedOrder);
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const runtimeConfig = useRuntimeConfig();

  if (!runtimeConfig.lightning) {
    throw createError({
      statusCode: 500,
      statusMessage: "Lightning configuration not found",
    });
  }

  const lightningConfig = runtimeConfig.lightning as LightningConfig;
  const lightningService = createLightningService(lightningConfig);

  try {
    const webhookEvent = await lightningService.processWebhook(body, "blink");

    if (!webhookEvent) {
      return {
        success: true,
        processed: false,
        message: "Event ignored",
      };
    }

    const ordersDatabase = `${runtimeConfig.dbLoginPrefix}-orders`;
    const invoiceDocId = `invoice-${webhookEvent.invoiceId}`;
    const invoiceDoc = await updateInvoiceDocument(
      ordersDatabase,
      invoiceDocId,
      webhookEvent,
    );

    if (webhookEvent.status === "paid" && invoiceDoc.orderId) {
      await updateOrderDocument(ordersDatabase, invoiceDoc.orderId, "active");
    } else if (webhookEvent.status === "expired" && invoiceDoc.orderId) {
      await updateOrderDocument(ordersDatabase, invoiceDoc.orderId, "expired");
    }

    return {
      success: true,
      processed: true,
      invoiceId: webhookEvent.invoiceId,
      status: webhookEvent.status,
    };
  } catch (error: any) {
    console.error("Blink webhook processing error:", error);

    throw createError({
      statusCode: 500,
      statusMessage: error?.message || "Error processing Blink webhook",
    });
  }
});
