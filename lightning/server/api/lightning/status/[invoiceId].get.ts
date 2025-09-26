import { defineEventHandler, getRouterParam, createError } from 'h3'
import { useLightning } from '../../../composables/useLightning'
import type { LightningConfig } from '../../../../types/lightning'

export default defineEventHandler(async (event) => {
    const invoiceId = getRouterParam(event, 'invoiceId')
    const runtimeConfig = useRuntimeConfig()
    
    if (!invoiceId) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Invoice ID is required'
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
        const lightningConfig = runtimeConfig.lightning as LightningConfig
        const { initialize, checkPaymentStatus } = useLightning()
        
        // Initialize the composable with config
        initialize(lightningConfig)
        
        // Check payment status
        const status = await checkPaymentStatus(invoiceId)
        
        if (!status) {
            throw createError({
                statusCode: 404,
                statusMessage: 'Invoice not found or status unavailable'
            })
        }
        
        return {
            success: true,
            status
        }
    } catch (e: any) {
        console.error('Status check error:', e)
        
        // Re-throw if it's already a createError
        if (e.statusCode) {
            throw e
        }
        
        // Otherwise, create a generic error
        throw createError({
            statusCode: 500,
            statusMessage: e.message || "Error checking payment status"
        })
    }
})