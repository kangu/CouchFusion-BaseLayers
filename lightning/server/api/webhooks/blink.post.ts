import { createError, defineEventHandler, readBody } from "h3";
import { getDocument, getView, putDocument, type CouchDBDocument } from "#database/utils/couchdb";
import { createLightningService } from "../../../services/lightning";
import type { WebhookEvent } from "../../../types/lightning";
import { updateLinkedInvoiceDocuments } from "#lightning/server/utils/invoice-links.mjs";
import { resolveLightningConfig } from "../../utils/lightning-config";

async function updateInvoiceDocument(
  databaseName: string,
  invoiceDocId: string,
  webhookEvent: WebhookEvent,
) {
  const invoiceDoc = await getDocument<CouchDBDocument>(databaseName, invoiceDocId);
  if (!invoiceDoc) {
    return null;
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
    return false;
  }

  const updatedOrder = {
    ...orderDoc,
    status,
  };

  await putDocument(databaseName, updatedOrder);
  return true;
}

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

    if (webhookEvent.status === "paid" && invoiceDoc?.orderId) {
      console.log("Blink webhook route updating order:", {
        orderId: invoiceDoc.orderId,
        status: "active",
      });
      const updatedOrder = await updateOrderDocument(
        ordersDatabase,
        invoiceDoc.orderId,
        "active",
      );
      if (!updatedOrder) {
        console.warn("Blink webhook route skipping missing order document:", {
          invoiceId: webhookEvent.invoiceId,
          orderId: invoiceDoc.orderId,
          status: webhookEvent.status,
        });
      }
    } else if (webhookEvent.status === "expired" && invoiceDoc?.orderId) {
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
