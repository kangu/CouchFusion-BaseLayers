import { getDocument, putDocument, type CouchDBDocument } from "#database/utils/couchdb";

interface FulfillmentProductConfig {
  invoiceField: string;
  invoiceIdField: string;
  orderIdField: string;
  statusField?: string;
  validUntilField?: string;
  createdStatus?: string;
  paidStatus?: string;
}

interface FulfillmentOptions {
  ordersDatabase: string;
  invoiceDoc: CouchDBDocument;
  orderDoc: CouchDBDocument;
}

interface FulfillmentResult {
  applied: boolean;
  product?: string;
  userName?: string;
  invoiceDoc?: CouchDBDocument;
}

const PRODUCT_FULFILLMENT: Record<string, FulfillmentProductConfig> = {
  pow_lab: {
    invoiceField: "pow_lab_invoice",
    invoiceIdField: "pow_lab_invoice_id",
    orderIdField: "pow_lab_order_id",
    statusField: "pow_lab_status",
    validUntilField: "pow_lab_valid_until",
    paidStatus: "active",
  },
  pow_lab_lite: {
    invoiceField: "pow_lab_lite_invoice",
    invoiceIdField: "pow_lab_lite_invoice_id",
    orderIdField: "pow_lab_lite_order_id",
    statusField: "pow_lab_lite_status",
    validUntilField: "pow_lab_lite_valid_until",
    paidStatus: "active",
  },
  conference_submission: {
    invoiceField: "conference_submission_invoice",
    invoiceIdField: "conference_submission_invoice_id",
    orderIdField: "conference_submission_order_id",
    statusField: "conference_submission_status",
    createdStatus: "pending_payment",
    paidStatus: "paid",
  },
};

const resolveProduct = (orderDoc: CouchDBDocument): string => {
  const product = orderDoc?.content?.product;
  return typeof product === "string" ? product.trim() : "";
};

const resolveUserName = (
  invoiceDoc: CouchDBDocument,
  orderDoc: CouchDBDocument,
): string => {
  const userName = orderDoc?.userName || invoiceDoc?.userName;
  return typeof userName === "string" ? userName.trim() : "";
};

const resolvePaymentRequest = (invoiceDoc: CouchDBDocument): string => {
  const paymentRequest = invoiceDoc?.invoiceData?.paymentRequest;
  return typeof paymentRequest === "string" ? paymentRequest : "";
};

const resolveProviderInvoiceId = (invoiceDoc: CouchDBDocument): string => {
  const invoiceId = invoiceDoc?.invoiceData?.id || invoiceDoc?.invoiceData?.invoiceId;
  return typeof invoiceId === "string" ? invoiceId.trim() : "";
};

const loadUserDocument = async (
  invoiceDoc: CouchDBDocument,
  orderDoc: CouchDBDocument,
): Promise<CouchDBDocument> => {
  const userName = resolveUserName(invoiceDoc, orderDoc);
  if (!userName) {
    throw new Error("Cannot fulfill order without a userName");
  }

  const userDocId = `org.couchdb.user:${userName}`;
  const userDoc = await getDocument<CouchDBDocument>("_users", userDocId);
  if (!userDoc) {
    throw new Error(`User document not found: ${userDocId}`);
  }

  return userDoc;
};

/**
 * Applies invoice-created side effects that were previously handled by the orders monitor.
 */
export const applyInvoiceCreatedFulfillment = async (
  options: FulfillmentOptions,
): Promise<FulfillmentResult> => {
  const product = resolveProduct(options.orderDoc);
  const config = PRODUCT_FULFILLMENT[product];
  if (!config) {
    return { applied: false, product };
  }

  const userDoc = await loadUserDocument(options.invoiceDoc, options.orderDoc);
  const updatedUserDoc = {
    ...userDoc,
    [config.invoiceField]: resolvePaymentRequest(options.invoiceDoc),
    [config.invoiceIdField]: resolveProviderInvoiceId(options.invoiceDoc),
    [config.orderIdField]: String(options.orderDoc._id || options.invoiceDoc.orderId || ""),
  };

  if (config.createdStatus && config.statusField) {
    updatedUserDoc[config.statusField] = config.createdStatus;
  }

  await putDocument("_users", updatedUserDoc);
  const fulfilledInvoiceDoc = {
    ...options.invoiceDoc,
    fulfillment: {
      ...(options.invoiceDoc.fulfillment || {}),
      status: "pending",
      product,
      updatedAt: new Date().toISOString(),
    },
  };
  await putDocument(options.ordersDatabase, fulfilledInvoiceDoc);

  return {
    applied: true,
    product,
    userName: resolveUserName(options.invoiceDoc, options.orderDoc),
    invoiceDoc: fulfilledInvoiceDoc,
  };
};

/**
 * Applies invoice-paid side effects that were previously handled by the orders monitor.
 */
export const applyInvoicePaidFulfillment = async (
  options: FulfillmentOptions,
): Promise<FulfillmentResult> => {
  const product = resolveProduct(options.orderDoc);
  const config = PRODUCT_FULFILLMENT[product];
  if (!config) {
    return { applied: false, product };
  }

  const userDoc = await loadUserDocument(options.invoiceDoc, options.orderDoc);
  const updatedUserDoc = {
    ...userDoc,
    [config.invoiceField]: "",
    [config.invoiceIdField]: "",
    [config.orderIdField]: "",
  };

  if (config.statusField && config.paidStatus) {
    updatedUserDoc[config.statusField] = config.paidStatus;
  }

  const validUntil = options.orderDoc?.content?.validUntil;
  if (config.validUntilField && typeof validUntil === "string" && validUntil.trim()) {
    updatedUserDoc[config.validUntilField] = validUntil;
  }

  await putDocument("_users", updatedUserDoc);
  const fulfilledInvoiceDoc = {
    ...options.invoiceDoc,
    lastEvent: "done",
    fulfillment: {
      ...(options.invoiceDoc.fulfillment || {}),
      status: "fulfilled",
      product,
      fulfilledAt: new Date().toISOString(),
      error: null,
    },
  };
  await putDocument(options.ordersDatabase, fulfilledInvoiceDoc);

  return {
    applied: true,
    product,
    userName: resolveUserName(options.invoiceDoc, options.orderDoc),
    invoiceDoc: fulfilledInvoiceDoc,
  };
};
