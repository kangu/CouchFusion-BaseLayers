import { describe, expect, it } from "vitest";
import {
  createPaymentEventBus,
  type PaymentEvent,
} from "../server/utils/payment-event-bus";

const buildEvent = (
  overrides: Partial<PaymentEvent> = {},
): PaymentEvent => ({
  id: "evt_1",
  type: "invoice.paid",
  invoiceId: "inv_123",
  status: "paid",
  createdAt: "2026-06-21T00:00:00.000Z",
  ...overrides,
});

describe("payment event bus", () => {
  it("delivers events to matching invoice subscribers only", () => {
    const bus = createPaymentEventBus({ maxReplayEvents: 10 });
    const received: PaymentEvent[] = [];

    const unsubscribe = bus.subscribe(
      { invoiceId: "inv_123" },
      (event) => received.push(event),
    );

    bus.publish(buildEvent({ id: "evt_match", invoiceId: "inv_123" }));
    bus.publish(buildEvent({ id: "evt_other", invoiceId: "inv_other" }));

    unsubscribe();

    expect(received).toHaveLength(1);
    expect(received[0].id).toBe("evt_match");
  });

  it("delivers events to matching order subscribers", () => {
    const bus = createPaymentEventBus({ maxReplayEvents: 10 });
    const received: PaymentEvent[] = [];

    bus.subscribe({ orderId: "purchase_123" }, (event) => {
      received.push(event);
    });

    bus.publish(buildEvent({ id: "evt_order", orderId: "purchase_123" }));
    bus.publish(buildEvent({ id: "evt_other", orderId: "purchase_other" }));

    expect(received.map((event) => event.id)).toEqual(["evt_order"]);
  });

  it("stops delivery after unsubscribe", () => {
    const bus = createPaymentEventBus({ maxReplayEvents: 10 });
    const received: PaymentEvent[] = [];

    const unsubscribe = bus.subscribe(
      { invoiceId: "inv_123" },
      (event) => received.push(event),
    );

    bus.publish(buildEvent({ id: "evt_before" }));
    unsubscribe();
    bus.publish(buildEvent({ id: "evt_after" }));

    expect(received.map((event) => event.id)).toEqual(["evt_before"]);
    expect(bus.getSubscriberCount()).toBe(0);
  });

  it("replays recent matching events to new subscribers", () => {
    const bus = createPaymentEventBus({ maxReplayEvents: 10 });
    const received: PaymentEvent[] = [];

    bus.publish(buildEvent({ id: "evt_old", invoiceId: "inv_123" }));
    bus.publish(buildEvent({ id: "evt_other", invoiceId: "inv_other" }));

    bus.subscribe(
      { invoiceId: "inv_123" },
      (event) => received.push(event),
      { replay: true },
    );

    expect(received.map((event) => event.id)).toEqual(["evt_old"]);
  });

  it("keeps replay buffer bounded", () => {
    const bus = createPaymentEventBus({ maxReplayEvents: 2 });
    const received: PaymentEvent[] = [];

    bus.publish(buildEvent({ id: "evt_1" }));
    bus.publish(buildEvent({ id: "evt_2" }));
    bus.publish(buildEvent({ id: "evt_3" }));

    bus.subscribe(
      { invoiceId: "inv_123" },
      (event) => received.push(event),
      { replay: true },
    );

    expect(received.map((event) => event.id)).toEqual(["evt_2", "evt_3"]);
  });
});
