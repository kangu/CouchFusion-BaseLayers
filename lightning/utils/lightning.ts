import { createLightningService } from '../services/lightning'
import type { LightningConfig, InvoiceRequest, InvoiceResponse } from '../types/lightning'

export interface CreateInvoiceOptions {
  amount: number
  currency?: string
  description?: string
  metadata?: Record<string, any>
  provider?: 'strike' | 'boltz'
}

export async function createLightningInvoice(
  config: LightningConfig, 
  options: CreateInvoiceOptions
): Promise<InvoiceResponse> {
  const lightningService = createLightningService(config)
  
  const invoiceRequest: InvoiceRequest = {
    amount: options.amount,
    currency: options.currency || 'sats',
    description: options.description,
    metadata: options.metadata
  }
  
  return await lightningService.createInvoice(invoiceRequest, options.provider)
}

export async function checkLightningInvoiceStatus(
  config: LightningConfig,
  invoiceId: string,
  provider?: 'strike' | 'boltz'
): Promise<InvoiceResponse> {
  const lightningService = createLightningService(config)
  return await lightningService.getInvoiceStatus(invoiceId, provider)
}