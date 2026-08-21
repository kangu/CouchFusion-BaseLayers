import type { LightningInvoiceStatus, LightningProviderName } from "../types/lightning";

interface PublicPaymentSource {
  id?: string;
  invoiceId: string;
  paymentRequest?: string;
  amount: number;
  currency: string;
  status: LightningInvoiceStatus;
  expiresAt?: Date | string;
  provider?: LightningProviderName;
  quoteId?: string;
  rate?: number;
  sourceCurrency?: string;
  targetCurrency?: string;
  sourceAmount?: number;
  targetAmount?: number;
}

export const toPublicPaymentInfo = (invoice: PublicPaymentSource) => Object.fromEntries(
  Object.entries({
    id: invoice.id || invoice.invoiceId,
    invoiceId: invoice.invoiceId,
    paymentRequest: invoice.paymentRequest || "",
    amount: invoice.amount,
    currency: invoice.currency,
    status: invoice.status,
    expiresAt: invoice.expiresAt || null,
    provider: invoice.provider,
    quoteId: invoice.quoteId,
    rate: invoice.rate,
    sourceCurrency: invoice.sourceCurrency,
    targetCurrency: invoice.targetCurrency,
    sourceAmount: invoice.sourceAmount,
    targetAmount: invoice.targetAmount,
  }).filter(([, value]) => value !== undefined),
);
