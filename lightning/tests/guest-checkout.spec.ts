import { describe, expect, it } from "vitest";
import {
  createGuestCheckoutToken,
  hashGuestCheckoutToken,
  toGuestCheckoutStatus,
} from "../utils/guest-checkout";

describe("Career Hub guest checkout utilities", () => {
  it("hashes an opaque checkout token without exposing it in status responses", () => {
    const token = createGuestCheckoutToken();

    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(hashGuestCheckoutToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(toGuestCheckoutStatus({
      status: "pending",
      guestCheckoutTokenHash: hashGuestCheckoutToken(token),
      invoiceData: {
        paymentRequest: "lnbc123",
        amount: 100,
      },
    })).toEqual({
      status: "pending",
      expiresAt: null,
      paidAt: null,
    });
  });
});
