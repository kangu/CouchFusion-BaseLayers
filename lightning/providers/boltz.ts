import crypto from 'crypto'
import type { LightningProvider, BoltzConfig, InvoiceRequest, InvoiceResponse, WebhookEvent } from '../types/lightning'

export function createBoltzProvider(config: BoltzConfig): LightningProvider {
  const baseUrl = config.apiUrl || 'https://api.boltz.exchange'
  const webhookUrl = process.env.NUXT_PUBLIC_SITE_URL ?
    `${process.env.NUXT_PUBLIC_SITE_URL}/api/webhooks/boltz` :
    undefined
  // Keep ephemeral claim data in-memory so we can auto-claim once invoice is settled
  const pendingClaims = new Map<string, { preimage: string; claimPrivateKey: string }>()

  const makeRequest = async (endpoint: string, options: RequestInit = {}) => {
    const url = `${baseUrl}${endpoint}`
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers
    }

    console.log(`[boltz] -> ${options.method || 'GET'} ${url}`, options.body ? `body: ${options.body}` : '')
    const response = await fetch(url, { ...options, headers })

    console.log(`[boltz] <- ${response.status} ${url}`)
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Boltz API error: ${response.status} - ${errorText}`)
    }

    return response.json()
  }

  const createInvoice = async (request: InvoiceRequest): Promise<InvoiceResponse> => {
    // Use caller-provided preimageHash if supplied, otherwise random
    const preimage = request.metadata?.preimage
      ? Buffer.from(request.metadata.preimage, 'hex')
      : crypto.randomBytes(32)
    const preimageHash = crypto.createHash('sha256').update(preimage).digest('hex')

    // Generate an ephemeral claim key (Boltz web also auto-generates). We return it for spending.
    const claimKey = crypto.createECDH('secp256k1')
    claimKey.generateKeys()
    const claimPublicKey = claimKey.getPublicKey('hex', 'compressed')
    const claimPrivateKey = claimKey.getPrivateKey('hex')

    const pairHash = config.pairHash || (await (async () => {
      const reversePairs = await makeRequest('/v2/swap/reverse')
      const hash = reversePairs?.BTC?.['L-BTC']?.hash
      if (!hash) {
        throw new Error('Boltz pairHash missing for BTC -> L-BTC')
      }
      return hash
    })())

    const swapRequest: Record<string, any> = {
      pairHash,
      from: 'BTC',
      to: 'L-BTC',
      invoiceAmount: request.amount,
      preimageHash,
      claimPublicKey,
      claimAddress: config.liquidAddress,
      ...(config.referralCode && { referralId: config.referralCode }),
      ...(webhookUrl && {
        webhook: {
          url: webhookUrl,
          hashSwapId: false,
          status: ['invoice.settled', 'invoice.expired', 'invoice.cancelled']
        }
      })
    }

    const response = await makeRequest('/v2/swap/reverse', {
      method: 'POST',
      body: JSON.stringify(swapRequest)
    })
    console.log('Swap params', swapRequest)
    console.log('Doing reverse swap request', response)

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
      preimage: preimage.toString('hex'),
      preimageHash,
      claimPublicKey,
      claimPrivateKey,
      lockupAddress: response.lockupAddress,
      blindingKey: response.claimDetails?.blindingKey,
      onchainAmount: response.onchainAmount,
      expiresAt: response.timeoutBlockHeight ?
        new Date(Date.now() + (response.timeoutBlockHeight * 10 * 60 * 1000)) : // Rough estimate
        undefined
    }
  }

  const tryAutoClaim = async (swapId: string, preimage: string, claimPrivateKey: string) => {
    try {
      // Fetch claim transaction and swap details
      const [claimInfo, swap] = await Promise.all([
        makeRequest(`/v2/swap/reverse/${swapId}/transaction`),
        makeRequest(`/v2/swap/${swapId}`)
      ])

      const serverPubKey =
        swap.claimDetails?.serverPublicKey ||
        swap.lockupDetails?.serverPublicKey ||
        claimInfo.serverPublicKey

      const transaction = claimInfo.transaction || claimInfo.hex
      const index = claimInfo.index ?? 0
      if (!serverPubKey || !transaction) {
        console.warn(`[boltz] auto-claim: missing serverPubKey or transaction for swap ${swapId}`)
        return
      }

      const { Musig } = await import('boltz-core')
      const { ECPairFactory } = await import('ecpair')
      // @ts-ignore secp import
      const ecc = await import('@bitcoinerlab/secp256k1')
      const ec = ECPairFactory(ecc)
      const claimant = ec.fromPrivateKey(Buffer.from(claimPrivateKey, 'hex'))
      const musig = new Musig([claimant.publicKey, Buffer.from(serverPubKey, 'hex')])
      const ourNonce = musig.getNonce(0)

      const payload = {
        index,
        preimage,
        pubNonce: Buffer.from(ourNonce).toString('hex'),
        transaction
      }

      const res = await makeRequest(`/v2/swap/reverse/${swapId}/claim`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      console.log(`[boltz] auto-claim submitted for swap ${swapId}`, res)
      // Once submitted, remove from pending to avoid repeats
      pendingClaims.delete(swapId)
    } catch (err) {
      console.error(`[boltz] auto-claim failed for swap ${swapId}`, err)
    }
  }

  const getInvoiceStatus = async (invoiceId: string): Promise<InvoiceResponse> => {
    const response = await makeRequest(`/v2/swap/${invoiceId}`)

    // If we have stored claim data and the swap is ready, auto-claim
    const stored = pendingClaims.get(invoiceId)
    const boltzStatus = response.status
    const isSettled = ['invoice.settled', 'transaction.mempool', 'transaction.confirmed'].includes(boltzStatus)
    if (stored && isSettled) {
      tryAutoClaim(invoiceId, stored.preimage, stored.claimPrivateKey)
    }

    return {
      invoiceId: response.id,
      paymentRequest: response.invoice,
      amount: response.invoiceAmount || 0,
      currency: 'sats',
      status: mapBoltzStatus(response.status),
      liquidAddress: response.claimAddress,
      swapId: response.id,
      lockupAddress: response.lockupAddress,
      onchainAmount: response.onchainAmount
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
