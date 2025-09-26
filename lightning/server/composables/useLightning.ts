import { createLightningInvoice, checkLightningInvoiceStatus, type CreateInvoiceOptions } from '../../utils/lightning'
import type { LightningConfig } from '../../types/lightning'

export interface PaymentOptions {
  description?: string
  metadata?: Record<string, any>
  provider?: 'strike' | 'boltz'
}

export interface PaymentInfo {
  id: string
  paymentRequest: string
  amount: number
  currency: string
  status: 'pending' | 'paid' | 'expired' | 'cancelled'
  expiresAt?: Date
  liquidAddress?: string
  swapId?: string
}

export interface PaymentError {
  message: string
  code?: string
  statusCode?: number
}

export function useLightning() {
  // State variables (not reactive since this is server-side)
  let loading = false
  let error: PaymentError | null = null
  let currentPayment: PaymentInfo | null = null
  let paymentStatus: string = 'idle'
  let statusInterval: NodeJS.Timeout | null = null
  let isPolling = false
  let config: LightningConfig | null = null

  // Initialize with config
  const initialize = (lightningConfig: LightningConfig) => {
    config = lightningConfig
  }

  // Clear error when starting new operations
  const clearError = () => {
    error = null
  }

  // Create a Lightning payment (invoice or swap)
  const createPayment = async (
    amount: number,
    options: PaymentOptions = {}
  ): Promise<PaymentInfo | null> => {
    if (!config) {
      throw new Error('Lightning config not initialized. Call initialize() first.')
    }

    if (amount <= 0) {
      error = { message: 'Amount must be greater than 0' }
      return null
    }

    clearError()
    loading = true

    try {
      console.log('Creating invoice', amount, options)
      const invoice = await createLightningInvoice(config, {
        amount,
        currency: 'sats',
        description: options.description,
        metadata: options.metadata,
        provider: options.provider
      })

      const payment: PaymentInfo = {
        id: invoice.invoiceId,
        paymentRequest: invoice.paymentRequest || '',
        amount: invoice.amount,
        currency: invoice.currency,
        status: invoice.status,
        expiresAt: invoice.expiresAt,
        liquidAddress: invoice.liquidAddress,
        swapId: invoice.swapId
      }

      currentPayment = payment
      paymentStatus = payment.status

      return payment
    } catch (err: any) {
      const errorMessage = err.message || 'Payment creation failed'
      error = {
        message: errorMessage,
        statusCode: err.statusCode
      }
      return null
    } finally {
      loading = false
    }
  }

  // Check payment status
  const checkPaymentStatus = async (invoiceId?: string): Promise<string | null> => {
    if (!config) {
      error = { message: 'Lightning config not initialized' }
      return null
    }

    const paymentId = invoiceId || currentPayment?.id

    if (!paymentId) {
      error = { message: 'No payment ID provided' }
      return null
    }

    try {
      const response = await checkLightningInvoiceStatus(config, paymentId)

      paymentStatus = response.status

      // Update current payment if it matches
      if (currentPayment?.id === paymentId) {
        currentPayment.status = response.status
        if (response.expiresAt) {
          currentPayment.expiresAt = response.expiresAt
        }
      }

      return response.status
    } catch (err: any) {
      console.warn('Status check failed:', err.message)
      return null
    }
  }

  // Start polling payment status
  const startStatusPolling = (intervalMs: number = 5000) => {
    if (!currentPayment || isPolling) return

    isPolling = true
    statusInterval = setInterval(async () => {
      const status = await checkPaymentStatus()

      // Stop polling if payment is complete or failed
      if (status && ['paid', 'expired', 'cancelled'].includes(status)) {
        stopStatusPolling()
      }
    }, intervalMs)
  }

  // Stop polling payment status
  const stopStatusPolling = () => {
    if (statusInterval) {
      clearInterval(statusInterval)
      statusInterval = null
    }
    isPolling = false
  }

  // Reset all state
  const reset = () => {
    stopStatusPolling()
    loading = false
    error = null
    currentPayment = null
    paymentStatus = 'idle'
  }

  // Computed-like getters
  const getIsPending = () => paymentStatus === 'pending' || loading
  const getIsPaid = () => paymentStatus === 'paid'
  const getIsExpired = () => paymentStatus === 'expired'
  const getIsCancelled = () => paymentStatus === 'cancelled'
  const getHasError = () => !!error
  const getPaymentUrl = () => {
    if (!currentPayment?.paymentRequest) return null
    return `lightning:${currentPayment.paymentRequest}`
  }

  // Auto-cleanup
  const cleanup = () => {
    stopStatusPolling()
  }

  // Return composable interface
  return {
    // State getters (since we can't use reactive)
    getLoading: () => loading,
    getError: () => error,
    getCurrentPayment: () => currentPayment,
    getPaymentStatus: () => paymentStatus,
    getIsPolling: () => isPolling,

    // Computed getters
    isPending: getIsPending,
    isPaid: getIsPaid,
    isExpired: getIsExpired,
    isCancelled: getIsCancelled,
    hasError: getHasError,
    paymentUrl: getPaymentUrl,

    // Methods
    initialize,
    createPayment,
    checkPaymentStatus,
    startStatusPolling,
    stopStatusPolling,
    clearError,
    reset,
    cleanup
  }
}
