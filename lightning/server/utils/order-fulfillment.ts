import { randomBytes } from "node:crypto";
import { createUser, getDocument, getView, putDocument, type CouchDBDocument } from "#database/utils/couchdb";
import { createLoginToken } from "#auth/server/utils/login-token";
import { queueTemplateEmail } from "#email/server/utils/template-queue";

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

interface MembershipNotificationConfig {
  customerTemplateName: string;
  adminTemplateName: string;
  product?: "pow_lab_lite";
}

const PRODUCT_FULFILLMENT: Record<string, FulfillmentProductConfig> = {
  pow_lab: {
    invoiceField: "pow_lab_invoice",
    invoiceIdField: "pow_lab_invoice_id",
    orderIdField: "pow_lab_order_id",
    statusField: "pow_lab_status",
    validUntilField: "pow_lab_valid_until",
    createdStatus: "pending_payment",
    paidStatus: "active",
  },
  pow_lab_lite: {
    invoiceField: "pow_lab_lite_invoice",
    invoiceIdField: "pow_lab_lite_invoice_id",
    orderIdField: "pow_lab_lite_order_id",
    statusField: "pow_lab_lite_status",
    validUntilField: "pow_lab_lite_valid_until",
    createdStatus: "pending_payment",
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

const MEMBERSHIP_NOTIFICATIONS: Record<string, MembershipNotificationConfig> = {
  pow_lab: {
    customerTemplateName: "welcome_to_pow_lab",
    adminTemplateName: "admin_order",
  },
  pow_lab_lite: {
    customerTemplateName: "welcome_to_pow_lab_lite",
    adminTemplateName: "admin_order_lite",
    product: "pow_lab_lite",
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

const resolveRequiredString = (value: unknown, fieldName: string): string => {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  throw new Error(`${fieldName} is required to queue membership notifications`);
};

/**
 * Produces display-safe text for optional order details required by email
 * templates, avoiding omitted JSON fields that make queue validation fail.
 */
const resolveNotificationText = (value: unknown): string => {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return "Not provided";
};

const wasNotificationQueued = (
  invoiceDoc: CouchDBDocument,
  notificationKey: "customer" | "admin" | "login",
): boolean => invoiceDoc?.fulfillment?.notifications?.[notificationKey]?.status === "queued";

/**
 * Identifies CouchDB optimistic-concurrency failures that are safe to retry
 * after reloading the latest invoice revision.
 */
const isDocumentConflict = (error: unknown): boolean =>
  Boolean(
    (error as { statusCode?: number })?.statusCode === 409
    || (error as { status?: number })?.status === 409
    || (error as { error?: string })?.error === "conflict",
  );

const markNotificationQueued = async (
  ordersDatabase: string,
  invoiceDoc: CouchDBDocument,
  notificationKey: "customer" | "admin" | "login",
  templateName: string,
): Promise<CouchDBDocument> => {
  let currentInvoiceDoc = invoiceDoc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (wasNotificationQueued(currentInvoiceDoc, notificationKey)) {
      return currentInvoiceDoc;
    }

    const updatedInvoiceDoc = {
      ...currentInvoiceDoc,
      fulfillment: {
        ...(currentInvoiceDoc.fulfillment || {}),
        notifications: {
          ...(currentInvoiceDoc.fulfillment?.notifications || {}),
          [notificationKey]: {
            status: "queued",
            templateName,
            queuedAt: new Date().toISOString(),
          },
        },
      },
    };

    try {
      const result = await putDocument(ordersDatabase, updatedInvoiceDoc);
      return {
        ...updatedInvoiceDoc,
        _rev: result.rev,
      };
    } catch (error) {
      if (!isDocumentConflict(error) || attempt === 2) {
        throw error;
      }

      const documentId = resolveRequiredString(invoiceDoc._id, "Invoice document ID");
      const reloadedInvoiceDoc = await getDocument<CouchDBDocument>(ordersDatabase, documentId);
      if (!reloadedInvoiceDoc) {
        throw error;
      }
      currentInvoiceDoc = reloadedInvoiceDoc;
    }
  }

  throw new Error("Unreachable notification marker retry state");
};

/**
 * Persists a recoverable fulfillment boundary before any email side effect.
 * Paid-invoice reconciliation can later resume documents left in this state.
 */
const markFulfillmentProcessing = async (
  ordersDatabase: string,
  invoiceDoc: CouchDBDocument,
  product: string,
): Promise<CouchDBDocument> => {
  let currentInvoiceDoc = invoiceDoc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const processingInvoiceDoc = {
      ...currentInvoiceDoc,
      fulfillment: {
        ...(currentInvoiceDoc.fulfillment || {}),
        status: "processing",
        product,
        updatedAt: new Date().toISOString(),
      },
    };

    try {
      const result = await putDocument(ordersDatabase, processingInvoiceDoc);
      return {
        ...processingInvoiceDoc,
        _rev: result.rev || processingInvoiceDoc._rev,
      };
    } catch (error) {
      if (!isDocumentConflict(error) || attempt === 2) {
        throw error;
      }

      const documentId = resolveRequiredString(invoiceDoc._id, "Invoice document ID");
      const reloadedInvoiceDoc = await getDocument<CouchDBDocument>(ordersDatabase, documentId);
      if (!reloadedInvoiceDoc) {
        throw error;
      }
      currentInvoiceDoc = reloadedInvoiceDoc;
    }
  }

  throw new Error("Unreachable fulfillment processing retry state");
};

const queueMembershipNotifications = async ({
  ordersDatabase,
  invoiceDoc,
  orderDoc,
  userDoc,
  product,
  validUntil,
}: {
  ordersDatabase: string;
  invoiceDoc: CouchDBDocument;
  orderDoc: CouchDBDocument;
  userDoc: CouchDBDocument;
  product: string;
  validUntil: string | undefined;
}): Promise<CouchDBDocument> => {
  const notificationConfig = MEMBERSHIP_NOTIFICATIONS[product];
  if (!notificationConfig) {
    return invoiceDoc;
  }

  const userEmail = resolveRequiredString(userDoc.email, "Member email");
  const subscriptionEndDate = resolveRequiredString(validUntil, "Subscription end date");
  const notificationProduct = notificationConfig.product
    ? { product: notificationConfig.product }
    : {};
  let nextInvoiceDoc = invoiceDoc;

  if (!wasNotificationQueued(nextInvoiceDoc, "customer")) {
    const customerResult = await queueTemplateEmail({
      templateName: notificationConfig.customerTemplateName,
      to: userEmail,
      payload: {
        user_email: userEmail,
        subscription_end_date: subscriptionEndDate,
        ...notificationProduct,
      },
    });
    if (!customerResult.ok) {
      throw new Error(
        `Failed to queue ${notificationConfig.customerTemplateName}: ${customerResult.errorMessage || "unknown error"}`,
      );
    }
    nextInvoiceDoc = await markNotificationQueued(
      ordersDatabase,
      nextInvoiceDoc,
      "customer",
      notificationConfig.customerTemplateName,
    );
  }

  if (!wasNotificationQueued(nextInvoiceDoc, "admin")) {
    const settingsDoc = await getDocument<CouchDBDocument>(ordersDatabase, "settings");
    const adminEmail = resolveRequiredString(
      settingsDoc?.orderNotifications?.recipientEmail,
      "Order notification recipient email",
    );
    const adminResult = await queueTemplateEmail({
      templateName: notificationConfig.adminTemplateName,
      to: adminEmail,
      payload: {
        // The queue handler copies this field to the outgoing email's Reply-To.
        replyTo: userEmail,
        user_email: userEmail,
        amount: orderDoc?.content?.sats,
        referrer: resolveNotificationText(orderDoc?.content?.referralSource),
        telegram: resolveNotificationText(orderDoc?.content?.telegram),
        timestamp: invoiceDoc.timestamp || invoiceDoc?.payment?.paidAt || new Date().toISOString(),
        ...notificationProduct,
      },
    });
    if (!adminResult.ok) {
      throw new Error(
        `Failed to queue ${notificationConfig.adminTemplateName}: ${adminResult.errorMessage || "unknown error"}`,
      );
    }
    nextInvoiceDoc = await markNotificationQueued(
      ordersDatabase,
      nextInvoiceDoc,
      "admin",
      notificationConfig.adminTemplateName,
    );
  }

  return nextInvoiceDoc;
};

/**
 * Parses a positive integer day count from product/order metadata.
 */
const resolveValidDays = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }

  return null;
};

/**
 * Resolves the date that should be used when applying a paid invoice extension.
 */
const resolvePaymentBaseDate = (invoiceDoc: CouchDBDocument): Date => {
  const candidates = [
    invoiceDoc?.payment?.paidAt,
    invoiceDoc?.payment?.updatedAt,
    invoiceDoc?.invoiceData?.paidAt,
    invoiceDoc?.invoiceData?.updatedAt,
    invoiceDoc?.timestamp,
  ];

  for (const value of candidates) {
    if (typeof value !== "string" || !value.trim()) {
      continue;
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
};

/**
 * Resolves the subscription validity window using the same order value consumed by
 * the external orders monitor, with a valid_days fallback for embedded processing.
 */
const resolvePaidSubscriptionValidUntil = (
  invoiceDoc: CouchDBDocument,
  orderDoc: CouchDBDocument,
  userDoc: CouchDBDocument,
  config: FulfillmentProductConfig,
): string | undefined => {
  const orderValidUntil = orderDoc?.content?.validUntil;
  if (typeof orderValidUntil === "string" && orderValidUntil.trim()) {
    return orderValidUntil.trim();
  }

  if (!config.validUntilField) {
    return undefined;
  }

  const validDays = resolveValidDays(orderDoc?.content?.valid_days ?? orderDoc?.content?.validDays);
  if (!validDays) {
    return undefined;
  }

  const paymentBaseDate = resolvePaymentBaseDate(invoiceDoc);
  const existingValidUntil = userDoc?.[config.validUntilField];
  let extensionBaseDate = paymentBaseDate;

  if (typeof existingValidUntil === "string" && existingValidUntil.trim()) {
    const existingDate = new Date(existingValidUntil);
    if (!Number.isNaN(existingDate.getTime()) && existingDate.getTime() > paymentBaseDate.getTime()) {
      extensionBaseDate = existingDate;
    }
  }

  const expirationDate = new Date(extensionBaseDate.getTime());
  expirationDate.setUTCDate(expirationDate.getUTCDate() + validDays);
  return expirationDate.toISOString();
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
 * Resolves or creates the account that receives a paid Career Hub guest order.
 */
const resolveGuestUserDocument = async (email: string, product: string): Promise<CouchDBDocument> => {
  const normalizedEmail = email.trim().toLowerCase();
  const config = useRuntimeConfig();
  const existingUsers = await getView("_users", "auth", "has_account_case_insensitive", {
    key: normalizedEmail,
  });
  const existingUser = existingUsers?.rows?.[0]?.value as CouchDBDocument | undefined;
  if (existingUser) {
    return existingUser;
  }

  const userName = `${config.dbLoginPrefix}${randomBytes(8).toString("hex")}`;
  const created = await createUser(userName, randomBytes(24).toString("hex"), {
    email: normalizedEmail,
    funnel: product,
    allow_affiliate: true,
    created_date: new Date().toISOString(),
  });
  if (!created.ok) {
    throw new Error("Failed to create Career Hub guest account.");
  }

  const userDoc = await getDocument<CouchDBDocument>("_users", `org.couchdb.user:${userName}`);
  if (!userDoc) {
    throw new Error("Created Career Hub guest account could not be loaded.");
  }
  return userDoc;
};

/**
 * Queues the existing login template for a paid guest account only once.
 */
const queueGuestLoginNotification = async ({
  ordersDatabase,
  invoiceDoc,
  userEmail,
  orderDoc,
}: {
  ordersDatabase: string;
  invoiceDoc: CouchDBDocument;
  userEmail: string;
  orderDoc: CouchDBDocument;
}): Promise<CouchDBDocument> => {
  if (wasNotificationQueued(invoiceDoc, "login")) {
    return invoiceDoc;
  }

  const funnel = resolveProduct(orderDoc) === "pow_lab" ? "pow_lab" : "pow_lab_lite";
  const token = await createLoginToken({ email: userEmail, funnel });
  const siteUrl = String(useRuntimeConfig().public?.siteUrl || process.env.NUXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  if (!siteUrl) {
    throw new Error("Public site URL is required to queue a magic login link.");
  }
  const settingsDoc = await getDocument<CouchDBDocument>(ordersDatabase, "settings");
  const supportEmail = resolveRequiredString(
    settingsDoc?.orderNotifications?.recipientEmail,
    "Order notification recipient email",
  );
  const result = await queueTemplateEmail({
    templateName: "login",
    to: userEmail,
    payload: {
      user_email: userEmail,
      magic_link_url: `${siteUrl}/confirm-login/${encodeURIComponent(token.email)}/${token.code}`,
      privacy_url: `${siteUrl}/privacy`,
      support_url: `${siteUrl}/contact`,
      unsubscribe_url: `mailto:${supportEmail}?subject=Unsubscribe`,
    },
  });
  if (!result.ok) {
    throw new Error(`Failed to queue login: ${result.errorMessage || "unknown error"}`);
  }
  return markNotificationQueued(ordersDatabase, invoiceDoc, "login", "login");
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

  // A renewal invoice must not revoke access already paid for by this member.
  const currentExpiry = config.validUntilField
    ? Date.parse(String(userDoc[config.validUntilField] || ""))
    : NaN;
  const hasUnexpiredMembership = Boolean(
    config.statusField &&
    userDoc[config.statusField] === "active" &&
    Number.isFinite(currentExpiry) &&
    currentExpiry > Date.now(),
  );

  if (config.createdStatus && config.statusField && !hasUnexpiredMembership) {
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
  const invoiceResult = await putDocument(options.ordersDatabase, fulfilledInvoiceDoc);

  return {
    applied: true,
    product,
    userName: resolveUserName(options.invoiceDoc, options.orderDoc),
    invoiceDoc: {
      ...fulfilledInvoiceDoc,
      _rev: invoiceResult.rev,
    },
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

  const guestEmail = typeof options.orderDoc?.guestEmail === "string"
    ? options.orderDoc.guestEmail.trim().toLowerCase()
    : "";
  const isGuestCheckout = ["career_hub_guest", "pow_lab_guest"].includes(String(options.orderDoc?.content?.checkoutType));
  const userDoc = isGuestCheckout
    ? await resolveGuestUserDocument(guestEmail, product)
    : await loadUserDocument(options.invoiceDoc, options.orderDoc);
  const userName = String(userDoc.name || "");
  let orderDoc = isGuestCheckout
    ? { ...options.orderDoc, userName, status: "active" }
    : options.orderDoc;
  let invoiceDoc = isGuestCheckout
    ? { ...options.invoiceDoc, userName, email: userDoc.email }
    : options.invoiceDoc;

  if (isGuestCheckout) {
    const invoiceResult = await putDocument(options.ordersDatabase, invoiceDoc);
    invoiceDoc = {
      ...invoiceDoc,
      _rev: invoiceResult.rev || invoiceDoc._rev,
    };
  }
  const updatedUserDoc = {
    ...userDoc,
    [config.invoiceField]: "",
    [config.invoiceIdField]: "",
    [config.orderIdField]: "",
  };

  if (config.statusField && config.paidStatus) {
    updatedUserDoc[config.statusField] = config.paidStatus;
  }

  const validUntil = resolvePaidSubscriptionValidUntil(
    invoiceDoc,
    orderDoc,
    userDoc,
    config,
  );
  if (config.validUntilField && validUntil) {
    updatedUserDoc[config.validUntilField] = validUntil;
  }

  orderDoc = {
    ...orderDoc,
    status: "active",
    ...(isGuestCheckout
      ? {
          content: {
            ...(orderDoc.content || {}),
            ...(validUntil ? { validUntil } : {}),
          },
        }
      : {}),
  };
  const orderResult = await putDocument(options.ordersDatabase, orderDoc);
  orderDoc = {
    ...orderDoc,
    _rev: orderResult.rev || orderDoc._rev,
  };

  await putDocument("_users", updatedUserDoc);
  invoiceDoc = await markFulfillmentProcessing(options.ordersDatabase, invoiceDoc, product);
  const invoiceWithNotifications = await queueMembershipNotifications({
    ordersDatabase: options.ordersDatabase,
    invoiceDoc,
    orderDoc,
    userDoc,
    product,
    validUntil,
  });
  const invoiceWithLoginNotification = isGuestCheckout
    ? await queueGuestLoginNotification({
      ordersDatabase: options.ordersDatabase,
      invoiceDoc: invoiceWithNotifications,
      userEmail: String(userDoc.email || guestEmail),
      orderDoc,
    })
    : invoiceWithNotifications;
  const fulfilledInvoiceDoc = {
    ...invoiceWithLoginNotification,
    lastEvent: "done",
    fulfillment: {
      ...(invoiceWithLoginNotification.fulfillment || {}),
      status: "fulfilled",
      product,
      fulfilledAt: new Date().toISOString(),
      error: null,
    },
  };
  const invoiceResult = await putDocument(options.ordersDatabase, fulfilledInvoiceDoc);

  return {
    applied: true,
    product,
    userName: resolveUserName(invoiceDoc, orderDoc),
    invoiceDoc: {
      ...fulfilledInvoiceDoc,
      _rev: invoiceResult.rev,
    },
  };
};
