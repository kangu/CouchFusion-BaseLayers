import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEvent } from "h3";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { hashGuestCheckoutToken } from "../utils/guest-checkout";

const getViewMock = vi.fn();

vi.mock("#database/utils/couchdb", () => ({
  getView: (...args: unknown[]) => getViewMock(...args),
}));

const createMockEvent = (token: string) => {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  const res = new ServerResponse(req);
  const event = createEvent(req, res);
  event.context = { params: { token } };
  return event;
};

describe("Career Hub guest checkout status route", () => {
  beforeEach(() => {
    getViewMock.mockReset();
    (globalThis as any).useRuntimeConfig = () => ({ dbLoginPrefix: "bv" });
  });

  it("returns only safe payment status for a matching opaque token", async () => {
    const token = "a".repeat(64);
    getViewMock.mockResolvedValue({
      rows: [{ value: {
        status: "paid",
        payment: { paidAt: "2026-08-17T10:01:00.000Z" },
        invoiceData: { paymentRequest: "lnbc-secret" },
        guestCheckoutTokenHash: hashGuestCheckoutToken(token),
      } }],
    });

    const handler = (await import("../server/api/lightning/career-hub-checkout/[token].get")).default;
    await expect(handler(createMockEvent(token))).resolves.toEqual({
      status: "paid",
      expiresAt: null,
      paidAt: "2026-08-17T10:01:00.000Z",
    });
    expect(getViewMock).toHaveBeenCalledWith("bv-orders", "lightning", "by_guest_checkout_token_hash", {
      key: hashGuestCheckoutToken(token),
      limit: 1,
    });
  });
});
