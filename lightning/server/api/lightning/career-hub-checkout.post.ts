import { createError, defineEventHandler, readBody } from "h3";
import { randomBytes } from "node:crypto";
import { putDocument } from "#database/utils/couchdb";
import { assertInvisibleFormShield, type InvisibleFormShieldPayload } from "#auth/server/utils/invisible-form-shield";
import { assertProofOfWork, type ProofOfWorkSolution } from "#auth/server/utils/proof-of-work-runtime";
import { useLightning } from "../../composables/useLightning";
import { getProductPrice, replaceMemoTemplate } from "../../../utils/orders";
import { createInvoicePaymentState } from "../../utils/payment-state";
import { createGuestCheckoutToken, hashGuestCheckoutToken } from "../../../utils/guest-checkout";
import { resolveLightningConfig } from "../../utils/lightning-config";

interface CareerHubCheckoutBody {
  email?: string;
  invisibleShield?: InvisibleFormShieldPayload;
  proofOfWork?: ProofOfWorkSolution;
}

const isValidEmail = (value: unknown): value is string =>
  typeof value === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());

/**
 * Creates a guest Career Hub invoice while keeping the existing authenticated
 * purchase endpoint and its session contract unchanged.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<CareerHubCheckoutBody>(event);
  if (!isValidEmail(body?.email)) {
    throw createError({ statusCode: 400, statusMessage: "A valid email address is required." });
  }

  assertInvisibleFormShield(body.invisibleShield, { purpose: "career_hub_checkout" });
  assertProofOfWork(body.proofOfWork, "career_hub_checkout");

  const runtimeConfig = useRuntimeConfig();
  if (!runtimeConfig.dbLoginPrefix) {
    throw createError({ statusCode: 500, statusMessage: "Database login prefix not configured." });
  }

  const ordersDatabase = `${runtimeConfig.dbLoginPrefix}-orders`;
  const email = body.email.trim().toLowerCase();
  const product = await getProductPrice("pow_lab_lite", ordersDatabase);
  const orderId = `purchase-${randomBytes(8).toString("hex")}`;
  const checkoutToken = createGuestCheckoutToken();
  const orderResult = await putDocument(ordersDatabase, {
    _id: orderId,
    type: "purchase",
    status: "pending",
    timestamp: new Date().toISOString(),
    guestEmail: email,
    content: {
      product: "pow_lab_lite",
      checkoutType: "career_hub_guest",
      sats: product.sats,
      valid_days: product.valid_days,
    },
  });

  if (!orderResult.ok) {
    throw createError({ statusCode: 500, statusMessage: "Unable to create checkout." });
  }

  const lightningConfig = await resolveLightningConfig(runtimeConfig);
  const { initialize, createPayment } = useLightning();
  initialize(lightningConfig);
  const invoice = await createPayment(product.sats, {
    description: replaceMemoTemplate(product.memo, {}),
    provider: lightningConfig.defaultProvider,
    metadata: { orderId, checkoutType: "career_hub_guest" },
  });

  if (!invoice) {
    throw createError({ statusCode: 502, statusMessage: "Unable to create payment invoice." });
  }

  const invoiceDocument = createInvoicePaymentState({
    _id: `invoice-${invoice.id}`,
    type: "lightning_invoice",
    timestamp: new Date().toISOString(),
    orderId,
    guestEmail: email,
    guestCheckoutTokenHash: hashGuestCheckoutToken(checkoutToken),
    invoiceData: invoice,
    amount: invoice.amount,
    lastEvent: "created",
  });
  const invoiceResult = await putDocument(ordersDatabase, invoiceDocument);
  if (!invoiceResult.ok) {
    throw createError({ statusCode: 500, statusMessage: "Unable to save payment invoice." });
  }

  return {
    success: true,
    checkoutToken,
    invoice: {
      id: invoice.id,
      paymentRequest: invoice.paymentRequest,
      amount: invoice.amount,
      expiresAt: invoice.expiresAt || null,
      status: invoice.status || "pending",
    },
  };
});
