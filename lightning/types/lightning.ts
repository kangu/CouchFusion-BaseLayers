export interface InvoiceRequest {
  amount: number
  currency: string
  description?: string
  metadata?: Record<string, any>
  correlationId?: string
}

export interface InvoiceResponse {
  invoiceId: string
  paymentRequest?: string
  amount: number
  currency: string
  status: 'pending' | 'paid' | 'expired' | 'cancelled'
  expiresAt?: Date
  liquidAddress?: string // For Boltz swaps
  swapId?: string // For Boltz swaps
  // Quote data (Strike provider)
  quoteId?: string
  rate?: number
  sourceCurrency?: string
  targetCurrency?: string
  sourceAmount?: number
  targetAmount?: number
}

export interface WebhookEvent {
  invoiceId: string
  status: string
  amount?: number
  currency?: string
  timestamp?: Date
  metadata?: Record<string, any>
}

export type LightningProvider = {
  createInvoice: (request: InvoiceRequest) => Promise<InvoiceResponse>
  getInvoiceStatus: (invoiceId: string) => Promise<InvoiceResponse>
  validateWebhook: (rawBody: string | undefined, signature?: string) => boolean
  processWebhook: (payload: any) => Promise<WebhookEvent | null>
  setupWebhookSubscription?: (webhookUrl: string) => Promise<any>
  listWebhookSubscriptions?: () => Promise<any>
  deleteWebhookSubscription?: (subscriptionId: string) => Promise<any>
}

export interface StrikeConfig {
  apiKey: string
  webhookSecret: string
  baseUrl?: string
}

export interface BoltzConfig {
  apiUrl: string
  network: 'mainnet' | 'testnet'
  liquidAddress: string
  referralCode?: string
}

export interface LightningConfig {
  defaultProvider: 'strike' | 'boltz'
  providers: {
    strike?: StrikeConfig
    boltz?: BoltzConfig
  }
}