import { defineEventHandler, readBody, createError } from 'h3'
import { useLightning } from '../../composables/useLightning'
import type { LightningConfig } from '../../../types/lightning'
import { createOrder, getProductPrice, saveInvoiceToDatabase, replaceMemoTemplate } from '../../../utils/orders'

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

    // Validate lightning config exists
    if (!runtimeConfig.lightning) {
        throw createError({
            statusCode: 500,
            statusMessage: 'Lightning configuration not found'
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
        let productInfo: { memo: string; sats: number }
        try {
            productInfo = await getProductPrice(body.product, ordersDatabase)
        } catch (error: any) {
            throw createError({
                statusCode: 400,
                statusMessage: error.message || 'Failed to get product info'
            })
        }

        const { memo, sats } = productInfo

        // Create order document with product and resolved sats
        const orderId = await createOrder({
            payload: { ...body, sats }, // Include resolved sats in order
            event,
            databaseName: ordersDatabase
        })
        const lightningConfig = runtimeConfig.lightning as LightningConfig
        const { initialize, createPayment } = useLightning()

        // Initialize the composable with config
        initialize(lightningConfig)

        // Process memo template with payload values
        const processedMemo = replaceMemoTemplate(memo, body)

        // Create invoice using the configured default provider with order ID
        const payment = await createPayment(sats, {
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

        // Save invoice data to database
        try {
            const invoiceDocId = await saveInvoiceToDatabase({
                invoiceData: payment,
                orderId: orderId,
                event: event,
                databaseName: ordersDatabase
            })
            console.log('Invoice saved to database:', invoiceDocId)
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
