export interface NwcInvoiceRecord {
  paymentHash: string
  invoice?: string
  amountMsats: number
  createdAt?: Date
  expiresAt?: Date
  state: string
}

export interface NwcClientAdapter {
  createInvoice: (input: { amountMsats: number; description?: string }) => Promise<NwcInvoiceRecord>
  lookupInvoice: (paymentHash: string) => Promise<NwcInvoiceRecord>
  subscribeToPayments: (handler: (paymentHash: string) => void | Promise<void>) => Promise<() => void>
  close: () => void | Promise<void>
  getWalletInfo: () => Promise<{ methods: string[]; notifications: string[] }>
}

const toDate = (value: unknown): Date | undefined => {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined
  return new Date(value * 1000)
}

const normalizeInvoice = (value: any): NwcInvoiceRecord => ({
  paymentHash: String(value?.payment_hash || value?.paymentHash || ""),
  invoice: typeof value?.invoice === "string" ? value.invoice : undefined,
  amountMsats: Number(value?.amount || value?.amount_msat || value?.amountMsats || 0),
  createdAt: toDate(value?.created_at),
  expiresAt: toDate(value?.expires_at),
  state: String(value?.state || value?.status || "pending"),
})

export const extractNwcNotificationPaymentHash = (event: any): string => (
  normalizeInvoice(event?.notification || event).paymentHash
)

/**
 * Creates the server-only NWC transport. SDK values are intentionally kept
 * behind this adapter so they cannot become part of the layer API surface.
 */
export const createNwcClientAdapter = async (connectionUri: string): Promise<NwcClientAdapter> => {
  const sdk = await import("@getalby/sdk") as any
  const Client = sdk?.nwc?.NWCClient || sdk?.NWCClient
  if (!Client) throw new Error("NWC SDK client is unavailable")

  const client = new Client({ nostrWalletConnectUrl: connectionUri })
  const createInvoice = async (input: { amountMsats: number; description?: string }) => {
    const response = await client.makeInvoice({ amount: input.amountMsats, description: input.description })
    return normalizeInvoice(response)
  }
  const lookupInvoice = async (paymentHash: string) => {
    const response = await client.lookupInvoice({ payment_hash: paymentHash })
    return normalizeInvoice(response)
  }
  const subscribeToPayments = async (handler: (paymentHash: string) => void | Promise<void>) => {
    const callback = async (event: any) => {
      const paymentHash = extractNwcNotificationPaymentHash(event)
      if (paymentHash) await handler(paymentHash)
    }
    const unsubscribe = client.subscribeNotifications
      ? await client.subscribeNotifications(callback, ["payment_received"])
      : undefined
    return () => { if (typeof unsubscribe === "function") unsubscribe() }
  }
  const getWalletInfo = async () => {
    const info = await client.getWalletServiceInfo()
    return {
      methods: Array.isArray(info?.capabilities) ? info.capabilities.map(String) : [],
      notifications: Array.isArray(info?.notifications) ? info.notifications.map(String) : [],
    }
  }

  return {
    createInvoice,
    lookupInvoice,
    subscribeToPayments,
    close: () => client.close?.(),
    getWalletInfo,
  }
}
