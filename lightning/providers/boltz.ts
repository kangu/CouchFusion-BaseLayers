import crypto from 'crypto'
import type { LightningProvider, BoltzConfig, InvoiceRequest, InvoiceResponse, WebhookEvent } from '../types/lightning'

export function createBoltzProvider(config: BoltzConfig): LightningProvider {
  const baseUrl = config.apiUrl || 'https://api.boltz.exchange'
  const webhookUrl = process.env.NUXT_PUBLIC_SITE_URL ?
    `${process.env.NUXT_PUBLIC_SITE_URL}/api/webhooks/boltz` :
    undefined

  const makeRequest = async (endpoint: string, options: RequestInit = {}) => {
    const url = `${baseUrl}${endpoint}`
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers
    }

    const response = await fetch(url, { ...options, headers })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Boltz API error: ${response.status} - ${errorText}`)
    }

    return response.json()
  }

  const createInvoice = async (request: InvoiceRequest): Promise<InvoiceResponse> => {
    // Generate preimage and hash for swap
    const preimage = crypto.randomBytes(32)
    const preimageHash = crypto.createHash('sha256').update(preimage).digest('hex')
    const claimKey = crypto.createECDH('secp256k1')
    claimKey.generateKeys()
    const refundKey = crypto.createECDH('secp256k1')
    refundKey.generateKeys()
    const claimPublicKey = claimKey.getPublicKey('hex', 'compressed')
    const refundPublicKey = refundKey.getPublicKey('hex', 'compressed')

    const pairId = config.network === 'testnet' ? 'BTC/L-BTC' : 'BTC/L-BTC'

    const swapRequest: Record<string, any> = {
      type: 'submarine',
      pairId,
      orderSide: 'buy',
        from: 'BTC',
        to: 'L-BTC',
      toAddress: config.liquidAddress,
      invoiceAmount: request.amount,
      preimageHash,
      refundPublicKey,
      ...(config.refundAddress && { refundAddress: config.refundAddress }),
      ...(config.referralCode && { referralId: config.referralCode }),
      ...(webhookUrl && {
        webhook: {
          url: webhookUrl,
          hashSwapId: false,
          status: ['invoice.settled', 'invoice.expired', 'invoice.cancelled']
        }
      })
    }

    const response = await makeRequest('/v2/swap/submarine', {
      method: 'POST',
      body: JSON.stringify(swapRequest)
    })
    console.log('Doing submarine swap request', response)

    // Store preimage for later claim (in production, use secure storage)
    // For now, we'll store it in metadata
    const swapId = response.id

    return {
      invoiceId: swapId,
      paymentRequest: response.invoice,
      amount: request.amount,
      currency: request.currency,
      status: 'pending',
      liquidAddress: config.liquidAddress,
      swapId,
      expiresAt: response.timeoutBlockHeight ?
        new Date(Date.now() + (response.timeoutBlockHeight * 10 * 60 * 1000)) : // Rough estimate
        undefined
    }
  }

  const getInvoiceStatus = async (invoiceId: string): Promise<InvoiceResponse> => {
    const response = await makeRequest(`/v2/swap/${invoiceId}`)

    return {
      invoiceId: response.id,
      paymentRequest: response.invoice,
      amount: response.invoiceAmount || 0,
      currency: 'sats',
      status: mapBoltzStatus(response.status),
      liquidAddress: response.claimAddress,
      swapId: response.id
    }
  }

  const validateWebhook = (rawBody: string | undefined, signature?: string): boolean => {
    // Boltz doesn't use webhook signatures, but we can validate the payload structure
    if (!rawBody) return false

    try {
      const payload = JSON.parse(rawBody)
      if (!payload || typeof payload !== 'object') return false

      // Basic payload validation
      return !!(payload.id && payload.status)
    } catch (error) {
      return false
    }
  }

  const processWebhook = async (payload: any): Promise<WebhookEvent | null> => {
    if (!payload?.id) {
      return null
    }

    return {
      invoiceId: payload.id,
      status: mapBoltzStatus(payload.status),
      timestamp: new Date(),
      metadata: {
        swapId: payload.id,
        transaction: payload.transaction,
        failureReason: payload.failureReason
      }
    }
  }

  const mapBoltzStatus = (boltzStatus: string): 'pending' | 'paid' | 'expired' | 'cancelled' => {
    switch (boltzStatus) {
      case 'swap.created':
      case 'invoice.pending':
        return 'pending'
      case 'transaction.claimed':
      case 'invoice.settled':
        return 'paid'
      case 'swap.expired':
      case 'invoice.expired':
        return 'expired'
      case 'swap.refunded':
        return 'cancelled'
      default:
        return 'pending'
    }
  }

  const setupWebhookSubscription = async (webhookUrl: string): Promise<any> => {
    // Boltz handles webhooks per-swap, not globally
    // Webhook URL is validated during swap creation
    console.log(`🔄 Boltz webhook subscription requested for: ${webhookUrl}`)
    console.log(`ℹ️ Boltz webhooks are configured per-swap, not globally`)
    return { success: true, note: 'Boltz webhooks configured per-swap' }
  }

  const listWebhookSubscriptions = async (): Promise<any> => {
    // Boltz doesn't have global webhook subscriptions
    console.log(`📋 Boltz webhook subscriptions: Boltz uses per-swap webhooks`)
    return []
  }

  const deleteWebhookSubscription = async (subscriptionId: string): Promise<any> => {
    // Boltz doesn't have global webhook subscriptions to delete
    console.log(`🗑️ Boltz webhook deletion requested for: ${subscriptionId}`)
    console.log(`ℹ️ Boltz webhooks are managed per-swap, not globally`)
    return { success: true, note: 'No global subscriptions to delete' }
  }

  return {
    createInvoice,
    getInvoiceStatus,
    validateWebhook,
    processWebhook,
    setupWebhookSubscription,
    listWebhookSubscriptions,
    deleteWebhookSubscription
  }
}
