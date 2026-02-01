import {randomUUID} from 'node:crypto'
import { useLightning } from '../../composables/useLightning'
import {defineEventHandler, readBody, createError} from 'h3'
import {useRuntimeConfig} from '#imports'
import {saveInvoiceToDatabase} from '../../../../../layers/lightning/utils/orders'
import type {LightningConfig} from "../../../types/lightning";

export default defineEventHandler(async (event) => {
    const body = await readBody<{ amount?: number; memo?: string; provider?: 'strike' | 'boltz' | 'alby' }>(event)
    const amount = Number(body?.amount || 0)
    const memo = typeof body?.memo === 'string' ? body.memo : ''
    const donationOrderId = randomUUID()

    if (!Number.isFinite(amount) || amount <= 0) {
        throw createError({statusCode: 400, statusMessage: 'Invalid amount'})
    }

    const config = useRuntimeConfig()
    // lightning config is provided by the lightning layer; surfaces under runtimeConfig.lightning
    const lightningConfig = config.lightning as LightningConfig
    if (!lightningConfig) {
        throw createError({
            statusCode: 500,
            statusMessage: 'Lightning configuration missing'
        })
    }
    const { initialize, createPayment } = useLightning()

    // Initialize the composable with config
    initialize(lightningConfig)

    try {
        // Create invoice using the configured default provider with order ID
        const payment = await createPayment(amount, {
            description: memo,
            provider: lightningConfig.defaultProvider,
            metadata: {
                orderId: donationOrderId, // Pass order document ID as unique identifier
                timestamp: new Date().toISOString(),
                userAgent: event.node.req.headers['user-agent']
            }
        })

        // Try to persist invoice + invoice code to the orders database (best-effort)
        const dbLoginPrefix = (config as any).dbLoginPrefix
        if (dbLoginPrefix) {
            const ordersDatabase = `${dbLoginPrefix}-orders`
            try {
                await saveInvoiceToDatabase({
                    invoiceData: payment,
                    orderId: donationOrderId,
                    event,
                    databaseName: ordersDatabase
                })
            } catch (persistErr: any) {
                console.error('[donation] failed to save invoice document', persistErr?.message || persistErr)
            }
        } else {
            console.warn('[donation] dbLoginPrefix not configured; skipping invoice persistence')
        }

        return payment
    } catch (error: any) {
        console.error('[donation] invoice creation failed', error)
        throw createError({
            statusCode: error?.statusCode || 500,
            statusMessage: error?.message || 'Invoice creation failed'
        })
    }
})
