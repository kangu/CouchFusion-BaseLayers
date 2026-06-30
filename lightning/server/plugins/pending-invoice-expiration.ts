import {
  getDocument,
  getView,
  putDocument,
  type CouchDBDocument,
} from "#database/utils/couchdb";
import { paymentEventBus } from "../utils/payment-event-bus";
import { expireStalePendingInvoices } from "../utils/pending-invoice-expiration";

const HEARTBEAT_INTERVAL_MS = 60 * 60 * 1000;
const HEARTBEAT_KEY = Symbol.for("bitvocation.lightning.pendingInvoiceExpirationHeartbeat");

interface HeartbeatState {
  timer?: ReturnType<typeof setInterval>;
  running: boolean;
}

interface HeartbeatGlobal {
  [HEARTBEAT_KEY]?: HeartbeatState;
}

/**
 * Stores heartbeat state across dev server hot reloads to avoid duplicate timers.
 */
const getHeartbeatState = (): HeartbeatState => {
  const globalState = globalThis as typeof globalThis & HeartbeatGlobal;
  if (!globalState[HEARTBEAT_KEY]) {
    globalState[HEARTBEAT_KEY] = { running: false };
  }

  return globalState[HEARTBEAT_KEY];
};

/**
 * Loads pending invoice documents from the lightning status view.
 */
const loadPendingInvoiceDocs = async (
  ordersDatabase: string,
): Promise<CouchDBDocument[]> => {
  const pendingView = await getView(ordersDatabase, "lightning", "by_status", {
    key: "pending",
    include_docs: true,
  });

  return (pendingView?.rows || [])
    .map((row) => row.doc)
    .filter((doc): doc is CouchDBDocument => Boolean(doc));
};

/**
 * Resolves the provider invoice id used to scope payment SSE events.
 */
const resolvePaymentEventInvoiceId = (invoiceDoc: CouchDBDocument): string => {
  const invoiceData = invoiceDoc.invoiceData || {};
  const invoiceId = invoiceData.id || invoiceData.invoiceId || invoiceDoc.invoiceId;
  if (typeof invoiceId === "string" && invoiceId.trim()) {
    return invoiceId.trim();
  }

  const documentId = typeof invoiceDoc._id === "string" ? invoiceDoc._id : "";
  return documentId.startsWith("invoice-") ? documentId.slice("invoice-".length) : documentId;
};

/**
 * Publishes an invoice-expired event for open membership payment screens.
 */
const publishExpiredInvoiceEvent = (
  invoiceDoc: CouchDBDocument,
  orderDoc: CouchDBDocument | undefined,
  eventTime: string,
): void => {
  const invoiceId = resolvePaymentEventInvoiceId(invoiceDoc);
  if (!invoiceId) {
    return;
  }

  const orderId = typeof invoiceDoc.orderId === "string"
    ? invoiceDoc.orderId
    : typeof orderDoc?._id === "string"
      ? orderDoc._id
      : "";
  const userName = typeof invoiceDoc.userName === "string"
    ? invoiceDoc.userName
    : typeof orderDoc?.userName === "string"
      ? orderDoc.userName
      : "";

  paymentEventBus.publish({
    id: `invoice-expired-${invoiceId}-${eventTime}`,
    type: "invoice.expired",
    status: "expired",
    invoiceId,
    orderId,
    userName,
    createdAt: eventTime,
    metadata: {
      source: "pending-invoice-expiration-heartbeat",
    },
  });
};

/**
 * Starts the hourly pending lightning invoice expiration heartbeat.
 */
export default defineNitroPlugin(() => {
  const heartbeatState = getHeartbeatState();
  if (heartbeatState.timer) {
    return;
  }

  const runtimeConfig = useRuntimeConfig();
  const dbLoginPrefix = runtimeConfig.dbLoginPrefix;
  if (!dbLoginPrefix) {
    console.warn("⚡ Pending invoice expiration heartbeat skipped: dbLoginPrefix is not configured");
    return;
  }

  const ordersDatabase = `${dbLoginPrefix}-orders`;

  const runHeartbeat = async (): Promise<void> => {
    if (heartbeatState.running) {
      return;
    }

    heartbeatState.running = true;
    try {
      const result = await expireStalePendingInvoices({
        ordersDatabase,
        getPendingInvoiceDocs: () => loadPendingInvoiceDocs(ordersDatabase),
        getDocument,
        putDocument,
        onInvoiceExpired: ({ invoiceDoc, orderDoc, eventTime }) => {
          publishExpiredInvoiceEvent(invoiceDoc, orderDoc, eventTime);
        },
      });

      if (result.expiredInvoices || result.expiredOrders) {
        console.log(
          `⚡ Expired ${result.expiredInvoices} pending lightning invoices and ${result.expiredOrders} linked orders`,
        );
      }
    } catch (error) {
      console.error("⚡ Pending lightning invoice expiration heartbeat failed", error);
    } finally {
      heartbeatState.running = false;
    }
  };

  heartbeatState.timer = setInterval(runHeartbeat, HEARTBEAT_INTERVAL_MS);
  heartbeatState.timer.unref?.();
  void runHeartbeat();
});
