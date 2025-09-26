import type { LightningProvider, LightningConfig, InvoiceRequest, InvoiceResponse } from '../types/lightning'
import { createStrikeProvider } from '../providers/strike'
import { createBoltzProvider } from '../providers/boltz'

export function createLightningService(config: LightningConfig) {
  const providerInstances = new Map<string, LightningProvider>()
  
  const getProvider = (providerName?: string): LightningProvider => {
    const name = providerName || config.defaultProvider
    
    // Return cached instance if available
    if (providerInstances.has(name)) {
      return providerInstances.get(name)!
    }
    
    // Create new provider instance
    let provider: LightningProvider
    
    switch (name) {
      case 'strike':
        if (!config.providers.strike) {
          throw new Error('Strike provider not configured')
        }
        provider = createStrikeProvider(config.providers.strike)
        break
        
      case 'boltz':
        if (!config.providers.boltz) {
          throw new Error('Boltz provider not configured')
        }
        provider = createBoltzProvider(config.providers.boltz)
        break
        
      default:
        throw new Error(`Unknown Lightning provider: ${name}`)
    }
    
    // Cache the instance
    providerInstances.set(name, provider)
    return provider
  }
  
  const createInvoice = async (
    request: InvoiceRequest, 
    providerName?: string
  ): Promise<InvoiceResponse> => {
    const provider = getProvider(providerName)
    return await provider.createInvoice(request)
  }
  
  const getInvoiceStatus = async (
    invoiceId: string, 
    providerName?: string
  ): Promise<InvoiceResponse> => {
    const provider = getProvider(providerName)
    return await provider.getInvoiceStatus(invoiceId)
  }
  
  const validateWebhook = (
    rawBody: string | undefined, 
    signature: string | undefined, 
    providerName?: string
  ): boolean => {
    const provider = getProvider(providerName)
    return provider.validateWebhook(rawBody, signature)
  }
  
  const processWebhook = async (payload: any, providerName?: string) => {
    const provider = getProvider(providerName)
    return await provider.processWebhook(payload)
  }
  
  const getAvailableProviders = (): string[] => {
    return Object.keys(config.providers)
  }
  
  const isProviderConfigured = (providerName: string): boolean => {
    return !!config.providers[providerName as keyof typeof config.providers]
  }
  
  return {
    createInvoice,
    getInvoiceStatus,
    validateWebhook,
    processWebhook,
    getProvider,
    getAvailableProviders,
    isProviderConfigured
  }
}