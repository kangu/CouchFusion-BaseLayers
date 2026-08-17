import { createHash, randomBytes } from "node:crypto";
import type { CouchDBDocument } from "#database/utils/couchdb";

export interface GuestCheckoutStatus {
  status: string;
  expiresAt: string | null;
  paidAt: string | null;
}

/**
 * Creates the high-entropy capability token returned to a guest checkout once.
 */
export const createGuestCheckoutToken = (): string => randomBytes(32).toString("hex");

/**
 * Hashes guest capability tokens before they are persisted to CouchDB.
 */
export const hashGuestCheckoutToken = (token: string): string => createHash("sha256")
  .update(token)
  .digest("hex");

/**
 * Maps an invoice document to the limited status contract exposed to a guest.
 */
export const toGuestCheckoutStatus = (invoiceDoc: CouchDBDocument): GuestCheckoutStatus => ({
  status: String(invoiceDoc.status || invoiceDoc.payment?.status || invoiceDoc.invoiceData?.status || "pending"),
  expiresAt: typeof invoiceDoc.expiresAt === "string"
    ? invoiceDoc.expiresAt
    : typeof invoiceDoc.invoiceData?.expiresAt === "string"
      ? invoiceDoc.invoiceData.expiresAt
      : null,
  paidAt: typeof invoiceDoc.payment?.paidAt === "string"
    ? invoiceDoc.payment.paidAt
    : typeof invoiceDoc.timestampPaid === "string"
      ? invoiceDoc.timestampPaid
      : null,
});
