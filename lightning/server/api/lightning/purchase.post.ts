import { defineEventHandler, readBody, createError, getHeader } from 'h3'
import { useLightning } from '../../composables/useLightning'
import { createOrder, getProductPrice, saveInvoiceToDatabase, replaceMemoTemplate } from '../../../utils/orders'
import { getDocument, getSession } from '#database/utils/couchdb'
import { applyInvoiceCreatedFulfillment } from '../../utils/order-fulfillment'
import { resolveLightningConfig } from '../../utils/lightning-config'

function extractAuthSessionCookie(cookieHeader: string | undefined): string | null {
    if (!cookieHeader) {
        return null
    }

    const cookies = cookieHeader.split(';')
    for (const cookie of cookies) {
        const trimmed = cookie.trim()
        if (trimmed.startsWith('AuthSession=')) {
            return trimmed.substring('AuthSession='.length)
        }
    }

    return null
}

async function resolveStartingDate(
    event: any,
    productKey: string
): Promise<Date> {
    const cookieHeader = getHeader(event, 'cookie')
    const authSessionCookie = extractAuthSessionCookie(cookieHeader)

    if (!authSessionCookie) {
        return new Date()
    }

    try {
        const sessionResponse = await getSession({ authSessionCookie })
        const userName = sessionResponse?.userCtx?.name

        if (!userName) {
            return new Date()
        }

        const userDocId = `org.couchdb.user:${userName}`
        const userDoc = await getDocument('_users', userDocId) as Record<string, unknown> | null

        if (!userDoc) {
            return new Date()
        }

        const subscriptionKey = `${productKey}_valid_until`
        const currentValue = userDoc[subscriptionKey]

        if (typeof currentValue !== 'string') {
            return new Date()
        }

        const currentDate = new Date(currentValue)
        if (Number.isNaN(currentDate.getTime())) {
            return new Date()
        }

        const now = Date.now()
        if (currentDate.getTime() > now) {
            return currentDate
        }

        return new Date()
    } catch (error) {
        console.warn('Failed to resolve user subscription start date:', error)
        return new Date()
    }
}

const resolveRenewalPrice = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return Math.round(value)
    }

    if (typeof value === 'string' && value.trim().length > 0) {
        const numeric = Number.parseInt(value.trim(), 10)
        if (Number.isFinite(numeric) && numeric > 0) {
            return Math.round(numeric)
        }
    }

    return null
}

async function resolveProductRenewalPrice(
    event: any,
    productKey: string
): Promise<number | null> {
    const cookieHeader = getHeader(event, 'cookie')
    const authSessionCookie = extractAuthSessionCookie(cookieHeader)

    if (!authSessionCookie) {
        return null
    }

    try {
        const sessionResponse = await getSession({ authSessionCookie })
        const userName = sessionResponse?.userCtx?.name

        if (!userName) {
            return null
        }

        const userDocId = `org.couchdb.user:${userName}`
        const userDoc = await getDocument('_users', userDocId) as Record<string, unknown> | null
        if (!userDoc) {
            return null
        }

        const renewalKey = `${productKey}_renewal_price`
        return resolveRenewalPrice(userDoc[renewalKey])
    } catch (error) {
        console.warn('Failed to resolve user renewal price override:', error)
        return null
    }
}

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const runtimeConfig = useRuntimeConfig()

    // Validation
    if (!body || typeof body.product !== 'string' || !body.product.trim()) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Invalid input: "product" must be a non-empty string',
        })
    }

    try {
        // Get runtime config for database naming
        const dbLoginPrefix = runtimeConfig.dbLoginPrefix;

        if (!dbLoginPrefix) {
            throw createError({
                statusCode: 500,
                statusMessage: 'Database login prefix not configured'
            })
        }

        // Construct orders database name
        const ordersDatabase = `${dbLoginPrefix}-orders`

        // Get product info from products document
        let productInfo: Awaited<ReturnType<typeof getProductPrice>>
        try {
            productInfo = await getProductPrice(body.product, ordersDatabase)
        } catch (error: any) {
            throw createError({
                statusCode: 400,
                statusMessage: error.message || 'Failed to get product info'
            })
        }

        const { memo, sats, valid_days } = productInfo
        const renewalPriceOverride = await resolveProductRenewalPrice(event, body.product)
        const resolvedSats = renewalPriceOverride ?? sats

        let validUntil: string | undefined
        if (typeof valid_days === 'number' && Number.isFinite(valid_days) && valid_days > 0) {
            const startingDate = await resolveStartingDate(event, body.product)
            const expirationDate = new Date(startingDate.getTime())
            expirationDate.setUTCDate(expirationDate.getUTCDate() + Math.floor(valid_days))
            validUntil = expirationDate.toISOString()
        }

        const orderPayload: Record<string, unknown> = { ...body, sats: resolvedSats }
        if (typeof valid_days === 'number' && Number.isFinite(valid_days) && valid_days > 0) {
            orderPayload.valid_days = Math.floor(valid_days)
        }
        if (validUntil) {
            orderPayload.validUntil = validUntil
        }

        // Create order document with product and resolved sats
        const orderId = await createOrder({
            payload: orderPayload, // Include resolved sats and optional validity window in order
            event,
            databaseName: ordersDatabase
        })
        const lightningConfig = await resolveLightningConfig(runtimeConfig)
        const { initialize, createPayment } = useLightning()

        // Initialize the composable with config
        initialize(lightningConfig)

        // Process memo template with payload values
        const processedMemo = replaceMemoTemplate(memo, body)

        // Create invoice using the configured default provider with order ID
        const payment = await createPayment(resolvedSats, {
            description: processedMemo,
            provider: lightningConfig.defaultProvider,
            metadata: {
                ...body.metadata,
                orderId: orderId, // Pass order document ID as unique identifier
                timestamp: new Date().toISOString(),
                userAgent: event.node.req.headers['user-agent']
            }
        })

        if (!payment) {
            throw new Error('Payment creation failed on server')
        }
        console.log('Got payment result', payment)

        // Save invoice data to database
        try {
            const invoiceDocId = await saveInvoiceToDatabase({
                invoiceData: payment,
                orderId: orderId,
                event: event,
                databaseName: ordersDatabase
            })
            console.log('Invoice saved to database:', invoiceDocId)

            const invoiceDoc = await getDocument(ordersDatabase, invoiceDocId)
            const orderDoc = await getDocument(ordersDatabase, orderId)
            if (invoiceDoc && orderDoc) {
                await applyInvoiceCreatedFulfillment({
                    ordersDatabase,
                    invoiceDoc,
                    orderDoc
                })
            }
        } catch (invoiceError: any) {
            console.error('Failed to save invoice to database:', invoiceError)
            // Continue execution - don't fail the purchase if invoice saving fails
        }

        return {
            success: true,
            invoice: payment
        }
    } catch (e: any) {
        console.error('Purchase processing error:', e)

        // Re-throw if it's already a createError
        if (e.statusCode) {
            throw e
        }

        // Otherwise, create a generic error
        throw createError({
            statusCode: 500,
            statusMessage: e.message || "Error processing purchase"
        })
    }
})
