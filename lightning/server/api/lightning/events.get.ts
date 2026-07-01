import {
  createError,
  defineEventHandler,
  getCookie,
  getQuery,
  setHeaders,
} from "h3";
import {
  getDocument,
  getSession,
  type CouchDBDocument,
} from "#database/utils/couchdb";
import { paymentEventBus } from "../../utils/payment-event-bus";
import type { PaymentEvent, PaymentEventScope } from "../../../types/payment-events";

const HEARTBEAT_INTERVAL_MS = 30_000;

const firstQueryValue = (value: unknown): string => {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0].trim() : "";
  }

  return typeof value === "string" ? value.trim() : "";
};

const sendSseEvent = (
  event: any,
  name: string,
  payload: Record<string, unknown>,
): void => {
  event.node.res.write(`event: ${name}\n`);
  event.node.res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

const getOrdersDatabase = (): string => {
  const runtimeConfig = useRuntimeConfig();
  const dbLoginPrefix = String(runtimeConfig.dbLoginPrefix || "").trim();

  if (!dbLoginPrefix) {
    throw createError({
      statusCode: 500,
      statusMessage: "dbLoginPrefix missing",
    });
  }

  return `${dbLoginPrefix}-orders`;
};

const getAuthenticatedUserName = async (event: any): Promise<string> => {
  const authSessionCookie = getCookie(event, "AuthSession");

  if (!authSessionCookie) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized: missing AuthSession cookie",
    });
  }

  const session = await getSession({ authSessionCookie });
  const userName = session?.userCtx?.name;

  if (!userName) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized: invalid session",
    });
  }

  return userName;
};

const resolveInvoiceDoc = async (
  ordersDatabase: string,
  invoiceId: string,
): Promise<CouchDBDocument | null> => {
  const invoiceDocId = invoiceId.startsWith("invoice-")
    ? invoiceId
    : `invoice-${invoiceId}`;

  return await getDocument<CouchDBDocument>(ordersDatabase, invoiceDocId);
};

const resolvePaymentScope = async (
  ordersDatabase: string,
  invoiceId: string,
  orderId: string,
  userName: string,
): Promise<PaymentEventScope> => {
  const invoiceDoc = invoiceId
    ? await resolveInvoiceDoc(ordersDatabase, invoiceId)
    : null;

  const orderDoc = orderId
    ? await getDocument<CouchDBDocument>(ordersDatabase, orderId)
    : null;

  const owningUser = invoiceDoc?.userName || orderDoc?.userName;

  if (!invoiceDoc && !orderDoc) {
    throw createError({
      statusCode: 404,
      statusMessage: "Payment document not found",
    });
  }

  if (!owningUser || owningUser !== userName) {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden: payment does not belong to current user",
    });
  }

  return {
    invoiceId: invoiceId || String(invoiceDoc?.invoiceData?.invoiceId || ""),
    orderId: orderId || String(invoiceDoc?.orderId || ""),
    userName,
  };
};

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const invoiceId = firstQueryValue(query.invoiceId);
  const orderId = firstQueryValue(query.orderId);

  if (!invoiceId && !orderId) {
    throw createError({
      statusCode: 400,
      statusMessage: "invoiceId or orderId is required",
    });
  }

  const userName = await getAuthenticatedUserName(event);
  const ordersDatabase = getOrdersDatabase();
  const scope = await resolvePaymentScope(
    ordersDatabase,
    invoiceId,
    orderId,
    userName,
  );

  setHeaders(event, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const unsubscribe = paymentEventBus.subscribe(
    scope,
    (paymentEvent: PaymentEvent) => {
      sendSseEvent(event, "payment", paymentEvent as unknown as Record<string, unknown>);
    },
    { replay: true },
  );

  sendSseEvent(event, "ready", {
    ok: true,
    invoiceId: scope.invoiceId || null,
    orderId: scope.orderId || null,
  });

  const heartbeat = setInterval(() => {
    try {
      event.node.res.write(": heartbeat\n\n");
    } catch {
      clearInterval(heartbeat);
      unsubscribe();
    }
  }, HEARTBEAT_INTERVAL_MS);

  const cleanup = () => {
    clearInterval(heartbeat);
    unsubscribe();
  };

  event.node.req.on("close", cleanup);
  event.node.req.on("aborted", cleanup);
});
