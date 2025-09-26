import crypto from 'crypto'
import type {LightningProvider, StrikeConfig, InvoiceRequest, InvoiceResponse, WebhookEvent} from '../types/lightning'

/**
 * Convert satoshis to BTC
 * @param sats - Amount in satoshis
 * @returns Amount in BTC as a string with proper precision
 */
function satsToBtc(sats: number): string {
    if (sats < 0) {
        throw new Error('Amount in sats cannot be negative')
    }
    // 1 BTC = 100,000,000 sats
    const btc = sats / 100_000_000
    // Return with 8 decimal places precision to handle satoshi-level precision
    return btc.toFixed(8)
}

export function createStrikeProvider(config: StrikeConfig): LightningProvider {
    const baseUrl = config.baseUrl || 'https://api.strike.me'

    const makeRequest = async (endpoint: string, options: RequestInit = {}) => {
        const url = `${baseUrl}${endpoint}`
        const headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
            ...options.headers
        }

        try {
            const response = await fetch(url, {...options, headers})

            if (!response.ok) {
                const errorText = await response.text()
                throw new Error(`Strike API error: ${response.status} - ${errorText}`)
            }

            return response.json()
        } catch (error) {
            throw new Error(`Strike API exception: ${error.message}`)
        }
    }

    const createInvoice = async (request: InvoiceRequest): Promise<InvoiceResponse> => {
        console.log('Request inside strike', request)

        // Convert sats to BTC for Strike API if currency is sats
        let amount: string
        let currency: string

        if (request.currency.toLowerCase() === 'sats') {
            amount = satsToBtc(request.amount)
            currency = 'BTC'
        } else {
            amount = request.amount.toString()
            currency = request.currency.toUpperCase()
        }

        const payload = {
            correlationId: request?.metadata.orderId || crypto.randomUUID(),
            description: request.description || 'Lightning payment',
            amount: {
                amount,
                currency
            }
        }
        console.log('Creating invoice with strike', payload)

        const invoiceResponse = await makeRequest('/v1/invoices', {
            method: 'POST',
            body: JSON.stringify(payload)
        })
        console.log('Strike invoice response', invoiceResponse)

        // Create quote for the invoice
        console.log('Creating quote for invoice', invoiceResponse.invoiceId)
        const quoteResponse = await makeRequest(`/v1/invoices/${invoiceResponse.invoiceId}/quote`, {
            method: 'POST'
        })
        console.log('Strike quote response', quoteResponse)

        // Combine invoice and quote data
        return {
            invoiceId: invoiceResponse.invoiceId,
            paymentRequest: quoteResponse.lnInvoice,
            amount: parseFloat(invoiceResponse.amount.amount),
            currency: invoiceResponse.amount.currency.toLowerCase(),
            status: mapStrikeStatus(invoiceResponse.state),
            expiresAt: invoiceResponse.expiration ? new Date(invoiceResponse.expiration) : undefined,
            // Quote data
            quoteId: quoteResponse.quoteId,
            rate: quoteResponse.rate ? parseFloat(quoteResponse.rate) : undefined,
            sourceCurrency: quoteResponse.sourceCurrency?.toLowerCase(),
            targetCurrency: quoteResponse.targetCurrency?.toLowerCase(),
            sourceAmount: quoteResponse.sourceAmount ? parseFloat(quoteResponse.sourceAmount) : undefined,
            targetAmount: quoteResponse.targetAmount ? parseFloat(quoteResponse.targetAmount) : undefined
        }
    }

    const getInvoiceById = async (invoiceId: string): Promise<any> => {
        try {
            console.log('🔍 Fetching current invoice state from Strike API:', invoiceId)
            const response = await makeRequest(`/v1/invoices/${invoiceId}`)
            console.log('📄 Strike API invoice response:', response)
            return response
        } catch (error) {
            console.error('❌ Failed to fetch invoice from Strike API:', error)
            throw error
        }
    }

    const getInvoiceStatus = async (invoiceId: string): Promise<InvoiceResponse> => {
        const response = await getInvoiceById(invoiceId)

        return {
            invoiceId: response.invoiceId,
            paymentRequest: response.lnInvoice,
            amount: parseFloat(response.amount.amount),
            currency: response.amount.currency.toLowerCase(),
            status: mapStrikeStatus(response.state),
            expiresAt: response.expiration ? new Date(response.expiration) : undefined
        }
    }

    const validateWebhook = (rawBody: string | undefined, signature: string | undefined): boolean => {
        if (!signature || !rawBody) {
            console.log('❌ Missing signature or raw body for webhook validation')
            return false
        }

        try {
            // Log debugging information (mask secret partially for security)
            const maskedSecret = config.webhookSecret ?
                `****${config.webhookSecret.slice(-4)}` : 'NOT_SET'
            console.log('🔐 Validating webhook signature with secret:', maskedSecret)
            console.log('📏 Raw body length:', rawBody.length)
            console.log('📝 Raw body preview:', rawBody.substring(0, 100) + '...')
            console.log('🏷️  Received signature:', signature)

            // Generate expected signature using raw body
            const expectedSignature = crypto
                .createHmac('sha256', config.webhookSecret)
                .update(rawBody, 'utf8')
                .digest('hex')

            console.log('🧮 Computed signature:', expectedSignature)

            // Compare signatures using timing-safe comparison
            const isValid = crypto.timingSafeEqual(
                Buffer.from(signature, 'hex'),
                Buffer.from(expectedSignature, 'hex')
            )

            console.log('✅ Signature validation result:', isValid)
            return isValid

        } catch (error) {
            console.error('❌ Strike webhook validation error:', error)
            return false
        }
    }

    const processWebhook = async (payload: any): Promise<WebhookEvent | null> => {
        console.log('🔔 Processing Strike webhook:', payload.eventType)

        // Validate payload structure
        if (!payload?.data?.entityId) {
            console.error('❌ Invalid webhook payload: missing entityId')
            return null
        }

        // Only process invoice.updated events with state changes
        if (payload.eventType === 'invoice.updated' &&
            payload.data.changes?.includes('state')) {

            console.log('📋 State change detected for invoice:', payload.data.entityId)

            try {
                // Fetch current invoice to get actual state
                const currentInvoice = await getInvoiceById(payload.data.entityId)

                const webhookEvent: WebhookEvent = {
                    invoiceId: payload.data.entityId,
                    status: mapStrikeStatus(currentInvoice.state),
                    amount: currentInvoice.amount ? parseFloat(currentInvoice.amount.amount) : undefined,
                    currency: currentInvoice.amount?.currency?.toLowerCase(),
                    timestamp: new Date(payload.created),
                    metadata: {
                        eventType: payload.eventType,
                        correlationId: currentInvoice.correlationId,
                        strikeState: currentInvoice.state
                    }
                }

                console.log('✅ Processed webhook event:', {
                    invoiceId: webhookEvent.invoiceId,
                    status: webhookEvent.status,
                    strikeState: currentInvoice.state
                })

                return webhookEvent

            } catch (error) {
                console.error('❌ Failed to fetch current invoice state:', error)

                // Fallback: return event with pending status (safe default)
                const fallbackEvent: WebhookEvent = {
                    invoiceId: payload.data.entityId,
                    status: 'pending',
                    timestamp: new Date(payload.created),
                    metadata: {
                        eventType: payload.eventType,
                        error: 'Failed to fetch current state',
                        fallback: true
                    }
                }

                console.log('⚠️ Using fallback webhook event due to API error')
                return fallbackEvent
            }
        }

        // Ignore non-state-change events
        console.log('ℹ️ Ignoring webhook event:', payload.eventType, 'changes:', payload.data.changes)
        return null
    }

    const mapStrikeStatus = (strikeState: string): 'pending' | 'paid' | 'expired' | 'cancelled' => {
        switch (strikeState) {
            case 'UNPAID':
            case 'PENDING':
                return 'pending'
            case 'PAID':
                return 'paid'
            case 'CANCELLED':
                return 'cancelled'
            default:
                return 'expired'
        }
    }

    const setupWebhookSubscription = async (webhookUrl: string): Promise<any> => {
        console.log('📋 Checking for existing Strike webhook subscriptions...')

        try {
            // First, check if a subscription already exists for this webhook URL
            const existingSubscriptions = await listWebhookSubscriptions()

            // Look for an existing active subscription with the same webhook URL
            const matchingSubscription = existingSubscriptions.find((sub: any) =>
                sub.webhookUrl === webhookUrl && sub.enabled === true
            )

            if (matchingSubscription) {
                console.log('✅ Found existing Strike webhook subscription for URL:', webhookUrl)
                console.log('📝 Existing subscription ID:', matchingSubscription.id)

                // Verify the existing subscription has the expected event types
                const expectedEventTypes = ['invoice.created', 'invoice.updated']
                const hasExpectedEvents = expectedEventTypes.every(eventType =>
                    matchingSubscription.eventTypes?.includes(eventType)
                )

                if (hasExpectedEvents) {
                    console.log('✅ Existing subscription has all required event types, skipping creation')
                    return matchingSubscription
                } else {
                    console.log('⚠️ Existing subscription missing required event types, will create new one')
                }
            } else {
                console.log('🔄 No existing subscription found, creating new one for:', webhookUrl)
            }
        } catch (listError) {
            console.warn('⚠️ Failed to list existing subscriptions, proceeding with creation:', listError.message)
            // Continue with creation attempt even if listing fails
        }

        // Create new subscription
        console.log('Creating subscription with secret', config.webhookSecret)
        const payload = {
            webhookUrl,
            webhookVersion: 'v1',
            secret: config.webhookSecret,
            enabled: true,
            eventTypes: [
                'invoice.created',
                'invoice.updated'
            ]
        }

        console.log('Setting up Strike webhook subscription:', { webhookUrl, eventTypes: payload.eventTypes })

        try {
            const response = await makeRequest('/v1/subscriptions', {
                method: 'POST',
                body: JSON.stringify(payload)
            })

            console.log('Strike webhook subscription created:', response)
            return response
        } catch (error) {
            console.error('Failed to setup Strike webhook subscription:', error)
            throw error
        }
    }

    const listWebhookSubscriptions = async (): Promise<any> => {
        try {
            const response = await makeRequest('/v1/subscriptions', {
                method: 'GET'
            })

            console.log('Strike webhook subscriptions:', response)
            return response
        } catch (error) {
            console.error('Failed to list Strike webhook subscriptions:', error)
            throw error
        }
    }

    const deleteWebhookSubscription = async (subscriptionId: string): Promise<any> => {
        try {
            const response = await makeRequest(`/v1/subscriptions/${subscriptionId}`, {
                method: 'DELETE'
            })

            console.log('Strike webhook subscription deleted:', subscriptionId)
            return response
        } catch (error) {
            console.error('Failed to delete Strike webhook subscription:', error)
            throw error
        }
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
