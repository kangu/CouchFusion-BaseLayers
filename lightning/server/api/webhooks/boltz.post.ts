import { defineEventHandler, readBody, createError } from 'h3'
import { createLightningService } from '../../../services/lightning'
import type { LightningConfig } from '../../../types/lightning'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const runtimeConfig = useRuntimeConfig()
  
  // Validate lightning config exists
  if (!runtimeConfig.lightning) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Lightning configuration not found'
    })
  }
  
  const lightningConfig = runtimeConfig.lightning as LightningConfig
  const lightningService = createLightningService(lightningConfig)
  
  // Validate webhook payload (Boltz doesn't use signatures)
  if (!lightningService.validateWebhook(body, undefined, 'boltz')) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid webhook payload'
    })
  }
  
  try {
    // Process webhook
    const webhookEvent = lightningService.processWebhook(body, 'boltz')
    
    // Log webhook event
    console.log('Boltz webhook received:', {
      swapId: webhookEvent.invoiceId,
      status: webhookEvent.status,
      timestamp: webhookEvent.timestamp,
      metadata: webhookEvent.metadata
    })
    
    // Handle swap completion - specifically looking for transaction.claimed
    if (webhookEvent.status === 'paid' && webhookEvent.metadata?.transaction) {
      // TODO: Implement your business logic here
      // Examples:
      // - Update user account with Liquid Bitcoin transaction details
      // - Send confirmation email with Liquid transaction ID
      // - Update internal records
      // - Trigger fulfillment process
      
      console.log(`Boltz swap completed - Liquid transaction: ${webhookEvent.metadata.transaction}`)
      console.log(`Swap ID: ${webhookEvent.invoiceId}`)
      
      // The user has successfully paid Lightning and received Liquid Bitcoin
      // You can now grant access or complete the purchase flow
    }
    
    // Handle other statuses
    if (webhookEvent.status === 'expired') {
      console.log(`Boltz swap expired: ${webhookEvent.invoiceId}`)
      // TODO: Handle expired swaps (cleanup, notification, etc.)
    }
    
    if (webhookEvent.status === 'cancelled') {
      console.log(`Boltz swap refunded: ${webhookEvent.invoiceId}`)
      // TODO: Handle refunded swaps
    }
    
    return { 
      success: true, 
      processed: true,
      swapId: webhookEvent.invoiceId,
      status: webhookEvent.status,
      transaction: webhookEvent.metadata?.transaction
    }
    
  } catch (error) {
    console.error('Boltz webhook processing error:', error)
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Error processing Boltz webhook'
    })
  }
})