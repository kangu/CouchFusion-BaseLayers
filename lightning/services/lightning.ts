import type { LightningProvider, LightningConfig, InvoiceLookupContext, InvoiceRequest, InvoiceResponse, LightningProviderName } from '../types/lightning'
import { createStrikeProvider } from '../providers/strike'
import { createAlbyProvider } from '../providers/alby'
import { createBlinkProvider } from '../providers/blink'
import { createNwcProvider } from '../providers/nwc'
import { createBlinkNcProvider } from '../providers/blink-nc'

export function createLightningService(config: LightningConfig) {
  const providerInstances = new Map<string, LightningProvider>()
  
  const getProvider = (providerName?: LightningProviderName): LightningProvider => {
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
        
      case 'alby':
        if (!config.providers.alby) {
          throw new Error('Alby provider not configured')
        }
        provider = createAlbyProvider(config.providers.alby)
        break

      case 'blink':
        if (!config.providers.blink) {
          throw new Error('Blink provider not configured')
        }
        provider = createBlinkProvider(config.providers.blink)
        break

      case 'nwc':
        if (!config.providers.nwc) {
          throw new Error('NWC provider not configured')
        }
        provider = createNwcProvider(config.providers.nwc)
        break

      case 'blink_nc':
        if (!config.providers.blink_nc) {
          throw new Error('Blink non-custodial provider not configured')
        }
        provider = createBlinkNcProvider(config.providers.blink_nc)
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
    providerName?: LightningProviderName
  ): Promise<InvoiceResponse> => {
    const provider = getProvider(providerName)
    return await provider.createInvoice(request)
  }
  
  const getInvoiceStatus = async (
    invoiceId: string, 
    providerName?: LightningProviderName,
    context?: InvoiceLookupContext,
  ): Promise<InvoiceResponse> => {
    const provider = getProvider(providerName)
    return await provider.getInvoiceStatus(invoiceId, context)
  }
  
  const validateWebhook = (
    rawBody: string | undefined, 
    signature: string | undefined, 
    providerName?: LightningProviderName
  ): boolean => {
    const provider = getProvider(providerName)
    return provider.validateWebhook(rawBody, signature)
  }
  
  const processWebhook = async (payload: any, providerName?: LightningProviderName) => {
    const provider = getProvider(providerName)
    return await provider.processWebhook(payload)
  }
  
  const getAvailableProviders = (): string[] => {
    return Object.keys(config.providers)
  }
  
  const isProviderConfigured = (providerName: LightningProviderName): boolean => {
    return !!config.providers[providerName]
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
