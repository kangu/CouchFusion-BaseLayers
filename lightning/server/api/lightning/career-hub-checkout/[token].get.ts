import { createError, defineEventHandler, getRouterParam } from "h3";
import { getView } from "#database/utils/couchdb";
import { hashGuestCheckoutToken, toGuestCheckoutStatus } from "../../../../utils/guest-checkout";

/**
 * Returns the limited payment state associated with a guest checkout token.
 */
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, "token");
  const dbLoginPrefix = useRuntimeConfig().dbLoginPrefix;
  if (!token || !dbLoginPrefix) {
    throw createError({ statusCode: 404, statusMessage: "Checkout not found." });
  }

  const result = await getView(
    `${dbLoginPrefix}-orders`,
    "lightning",
    "by_guest_checkout_token_hash",
    { key: hashGuestCheckoutToken(token), limit: 1 },
  );
  const invoiceDoc = result?.rows?.[0]?.value;
  if (!invoiceDoc || invoiceDoc.status === "superseded") {
    throw createError({ statusCode: 404, statusMessage: "Checkout not found." });
  }

  return toGuestCheckoutStatus(invoiceDoc);
});
