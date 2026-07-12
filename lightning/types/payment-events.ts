export type PaymentProvider = "strike" | "blink" | "alby" | "nwc";

export type PaymentEventType =
  | "invoice.created"
  | "invoice.paid"
  | "invoice.expired"
  | "invoice.cancelled"
  | "order.fulfilled"
  | "order.fulfillment_failed";

export type PaymentEventStatus =
  | "pending"
  | "paid"
  | "expired"
  | "cancelled"
  | "fulfilled"
  | "failed";

export interface PaymentEvent {
  id: string;
  type: PaymentEventType;
  provider?: PaymentProvider;
  invoiceId: string;
  orderId?: string;
  userName?: string;
  status: PaymentEventStatus;
  createdAt: string;
  retryAfterMs?: number;
  metadata?: Record<string, unknown>;
}

export interface PaymentEventScope {
  invoiceId?: string;
  orderId?: string;
  userName?: string;
}
