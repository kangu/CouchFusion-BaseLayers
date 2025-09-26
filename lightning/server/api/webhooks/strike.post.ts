import {defineEventHandler, readBody, readRawBody, getHeader, createError} from 'h3'
import {createLightningService} from '../../../services/lightning'
import type {LightningConfig} from '../../../types/lightning'
import {getDocument, putDocument, type CouchDBDocument} from '#database/utils/couchdb'
import type {WebhookEvent} from '../../../types/lightning'

/**
 * Process payment completion by updating invoice and order documents
 */
async function processPaymentCompletion(webhookEvent: WebhookEvent, runtimeConfig: any): Promise<void> {
    console.log('💰 Processing payment completion for invoice:', webhookEvent.invoiceId)

    // Get database name
    const ordersDatabase = `${runtimeConfig.dbLoginPrefix}-orders`
    console.log('🗄️ Using orders database:', ordersDatabase)

    // Validate required data
    if (!webhookEvent.metadata?.correlationId) {
        console.error('❌ Missing correlationId in webhook metadata')
        throw new Error('Cannot process payment: missing correlationId')
    }

    const invoiceDocId = `invoice-${webhookEvent.invoiceId}`
    const orderDocId = webhookEvent.metadata.correlationId

    console.log('📄 Processing documents:', { invoiceDocId, orderDocId })

    try {
        // Update invoice document
        await updateInvoiceDocument(ordersDatabase, invoiceDocId, webhookEvent)

        // Update order document
        await updateOrderDocument(ordersDatabase, orderDocId, webhookEvent)

        console.log('✅ Payment processing through database docs successful')

    } catch (error) {
        console.error('❌ Payment completion processing failed:', error)
        throw error
    }
}

/**
 * Update invoice document with payment completion
 */
async function updateInvoiceDocument(databaseName: string, invoiceDocId: string, webhookEvent: WebhookEvent): Promise<void> {
    console.log('📝 Updating invoice document:', invoiceDocId)

    try {
        // Fetch existing invoice document
        const invoiceDoc = await getDocument<CouchDBDocument>(databaseName, invoiceDocId)

        if (!invoiceDoc) {
            console.error('❌ Invoice document not found:', invoiceDocId)
            throw new Error(`Invoice document not found: ${invoiceDocId}`)
        }

        console.log('📖 Found invoice document, updating status...')

        // Update invoice document fields
        const updatedInvoice = {
            ...invoiceDoc,
            lastEvent: 'paid',
            invoiceData: {
                ...invoiceDoc.invoiceData,
                status: 'paid'
            },
            timestampPaid: new Date().toISOString()
        }

        // Save updated document
        const result = await putDocument(databaseName, updatedInvoice)
        console.log('✅ Invoice document updated successfully:', result.id, 'rev:', result.rev)

    } catch (error) {
        console.error('❌ Failed to update invoice document:', error)
        throw new Error(`Invoice update failed: ${error.message}`)
    }
}

/**
 * Update order document to active status
 */
async function updateOrderDocument(databaseName: string, orderDocId: string, webhookEvent: WebhookEvent): Promise<void> {
    console.log('📝 Updating order document:', orderDocId)

    try {
        // Fetch existing order document
        const orderDoc = await getDocument<CouchDBDocument>(databaseName, orderDocId)

        if (!orderDoc) {
            console.error('❌ Order document not found:', orderDocId)
            throw new Error(`Order document not found: ${orderDocId}`)
        }

        console.log('📖 Found order document, activating...')

        // Update order document status
        const updatedOrder = {
            ...orderDoc,
            status: 'active'
        }

        // Save updated document
        const result = await putDocument(databaseName, updatedOrder)
        console.log('✅ Order document activated successfully:', result.id, 'rev:', result.rev)

    } catch (error) {
        console.error('❌ Failed to update order document:', error)
        throw new Error(`Order update failed: ${error.message}`)
    }
}

export default defineEventHandler(async (event) => {
    // Get raw body first for signature verification
    const rawBody = await readRawBody(event, 'utf8')
    // Parse body for processing
    const body = rawBody ? JSON.parse(rawBody) : {}

    // Get signature from header (try different variations)
    const signature = getHeader(event, 'X-Webhook-Signature') ||
                     getHeader(event, 'x-webhook-signature') ||
                     getHeader(event, 'webhook-signature')

    const runtimeConfig = useRuntimeConfig()

    // Validate lightning config exists
    if (!runtimeConfig.lightning) {
        throw createError({
            statusCode: 500,
            statusMessage: 'Lightning configuration not found'
        })
    }

    console.log('Strike webhook received')
    console.log('Raw body length:', rawBody?.length || 0)
    console.log('Parsed body:', body)
    console.log('Signature header:', signature)

    const lightningConfig = runtimeConfig.lightning as LightningConfig
    const lightningService = createLightningService(lightningConfig)

    // Validate webhook signature using raw body
    if (!lightningService.validateWebhook(rawBody, signature, 'strike')) {
        console.log('Invalid signature')
        throw createError({
            statusCode: 401,
            statusMessage: 'Invalid webhook signature'
        })
    }

    try {
        // Process webhook (now async)
        const webhookEvent = await lightningService.processWebhook(body, 'strike')

        // Handle case where webhook processing returns null (ignored events)
        if (!webhookEvent) {
            console.log('📭 Webhook event ignored (not a state change)')
            return {
                success: true,
                processed: false,
                message: 'Event ignored'
            }
        }

        // Log webhook event (in production, you might want to store this in database)
        console.log('Strike webhook processed:', {
            invoiceId: webhookEvent.invoiceId,
            status: webhookEvent.status,
            timestamp: webhookEvent.timestamp,
            metadata: webhookEvent.metadata
        })

        // Handle payment completion
        if (webhookEvent.status === 'paid') {
            console.log('🎉 Payment completed for invoice:', webhookEvent.invoiceId)

            try {
                // Process payment completion - update invoice and order documents
                await processPaymentCompletion(webhookEvent, runtimeConfig)

                console.log('✅ Payment completion processing successful')

            } catch (processingError) {
                console.error('❌ Payment completion processing failed:', processingError)

                // Log the error but don't fail the webhook
                // The payment was successful, we just couldn't update our records
                console.log('⚠️ Webhook will return success despite processing error to avoid retries')
            }

            console.log('Full webhook event:', webhookEvent)
        } else {
            console.log(`📊 Invoice status updated to: ${webhookEvent.status}`)
        }

        return {
            success: true,
            processed: true,
            invoiceId: webhookEvent.invoiceId,
            status: webhookEvent.status
        }

    } catch (error) {
        console.error('Strike webhook processing error:', error)

        throw createError({
            statusCode: 500,
            statusMessage: 'Error processing Strike webhook'
        })
    }
})
