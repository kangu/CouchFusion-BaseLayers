import type { PaymentEvent, PaymentEventScope } from "../../types/payment-events";

export type { PaymentEvent, PaymentEventScope } from "../../types/payment-events";

export interface PaymentEventBusOptions {
  maxReplayEvents?: number;
}

export interface PaymentEventSubscribeOptions {
  replay?: boolean;
}

type PaymentEventHandler = (event: PaymentEvent) => void;

interface Subscriber {
  scope: PaymentEventScope;
  handler: PaymentEventHandler;
}

const hasScope = (scope: PaymentEventScope): boolean =>
  Boolean(scope.invoiceId || scope.orderId);

const matchesScope = (scope: PaymentEventScope, event: PaymentEvent): boolean => {
  if (!hasScope(scope)) {
    return false;
  }

  if (scope.invoiceId && event.invoiceId !== scope.invoiceId) {
    return false;
  }

  if (scope.orderId && event.orderId !== scope.orderId) {
    return false;
  }

  if (scope.userName && event.userName && event.userName !== scope.userName) {
    return false;
  }

  return true;
};

export const createPaymentEventBus = (
  options: PaymentEventBusOptions = {},
) => {
  const subscribers = new Set<Subscriber>();
  const replayEvents: PaymentEvent[] = [];
  const maxReplayEvents = Math.max(0, options.maxReplayEvents ?? 100);

  const publish = (event: PaymentEvent): void => {
    if (maxReplayEvents > 0) {
      replayEvents.push(event);
      while (replayEvents.length > maxReplayEvents) {
        replayEvents.shift();
      }
    }

    for (const subscriber of subscribers) {
      if (matchesScope(subscriber.scope, event)) {
        subscriber.handler(event);
      }
    }
  };

  const subscribe = (
    scope: PaymentEventScope,
    handler: PaymentEventHandler,
    options: PaymentEventSubscribeOptions = {},
  ): (() => void) => {
    const subscriber = { scope, handler };
    subscribers.add(subscriber);

    if (options.replay) {
      for (const event of replayEvents) {
        if (matchesScope(scope, event)) {
          handler(event);
        }
      }
    }

    return () => {
      subscribers.delete(subscriber);
    };
  };

  const getSubscriberCount = (): number => subscribers.size;

  return {
    publish,
    subscribe,
    getSubscriberCount,
  };
};

const globalThisWithPaymentEvents = globalThis as typeof globalThis & {
  __paymentEventBus?: ReturnType<typeof createPaymentEventBus>;
};

export const paymentEventBus =
  globalThisWithPaymentEvents.__paymentEventBus ||
  (globalThisWithPaymentEvents.__paymentEventBus = createPaymentEventBus());
