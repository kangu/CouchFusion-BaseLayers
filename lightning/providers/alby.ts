import type { LightningProvider, AlbyConfig, InvoiceRequest, InvoiceResponse, WebhookEvent } from '../types/lightning'

export function createAlbyProvider(config: AlbyConfig): LightningProvider {
  const baseUrl = config.apiUrl || 'https://api.getalby.com'

  const makeRequest = async (endpoint: string, options: RequestInit = {}) => {
    const url = `${baseUrl}${endpoint}`
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.accessToken}`,
      ...options.headers
    }

    const res = await fetch(url, { ...options, headers })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Alby API error: ${res.status} - ${text}`)
    }
    return res.json()
  }

  const createInvoice = async (request: InvoiceRequest): Promise<InvoiceResponse> => {
    const payload: Record<string, any> = {
      amount: request.amount,           // sats
      currency: 'btc',
      description: request.description || 'Invoice'
    }
    const res = await makeRequest('/invoices', {
      method: 'POST',
      body: JSON.stringify(payload)
    })

    return {
      invoiceId: res.payment_hash,
      paymentRequest: res.payment_request,
      amount: request.amount,
      currency: request.currency || 'sats',
      status: 'pending',
      expiresAt: res.expires_at ? new Date(res.expires_at) : undefined
    }
  }

  const getInvoiceStatus = async (invoiceId: string): Promise<InvoiceResponse> => {
    const res = await makeRequest(`/invoices/${invoiceId}`)
    const settled = !!res.settled_at
    const expired = res.expires_at ? new Date(res.expires_at).getTime() < Date.now() : false

    return {
      invoiceId,
      paymentRequest: res.payment_request,
      amount: res.amount || 0,
      currency: 'sats',
      status: settled ? 'paid' : expired ? 'expired' : 'pending',
      expiresAt: res.expires_at ? new Date(res.expires_at) : undefined
    }
  }

  const validateWebhook = (rawBody: string | undefined, signature?: string): boolean => {
    if (!config.webhookSecret) return false
    if (!rawBody || !signature) return false
    // SVIX format: t=timestamp,v1=signature
    try {
      const parts = Object.fromEntries(signature.split(',').map(p => p.split('=')))
      const sig = parts.v1
      const t = parts.t
      if (!sig || !t) return false
      const data = `${t}.${rawBody}`
      const crypto = require('crypto')
      const hmac = crypto.createHmac('sha256', config.webhookSecret)
      const expected = hmac.update(data).digest('hex')
      return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'))
    } catch {
      return false
    }
  }

  const processWebhook = async (payload: any): Promise<WebhookEvent | null> => {
    if (!payload?.type || !payload?.data) return null
    if (payload.type === 'invoice.incoming.settled') {
      return {
        invoiceId: payload.data.payment_hash,
        status: 'paid',
        timestamp: payload.created_at ? new Date(payload.created_at) : new Date(),
        metadata: payload
      }
    }
    return null
  }

  const setupWebhookSubscription = async (webhookUrl: string): Promise<any> => {
    if (!webhookUrl) return { success: false, note: 'webhookUrl not provided' }
    if (config.webhookEndpointId && config.webhookSecret) {
      return { success: true, endpointId: config.webhookEndpointId, secret: config.webhookSecret, note: 'using cached endpoint' }
    }
    const res = await makeRequest('/webhook_endpoints', {
      method: 'POST',
      body: JSON.stringify({
        url: webhookUrl,
        filter_types: ['invoice.incoming.settled']
      })
    })
    config.webhookEndpointId = res.id
    config.webhookSecret = res.endpoint_secret
    return { success: true, endpointId: res.id, secret: res.endpoint_secret }
  }

  const listWebhookSubscriptions = async (): Promise<any> => {
    return makeRequest('/webhook_endpoints')
  }

  const deleteWebhookSubscription = async (endpointId: string): Promise<any> => {
    return makeRequest(`/webhook_endpoints/${endpointId}`, { method: 'DELETE' })
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
