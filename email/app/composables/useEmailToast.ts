import type { Ref } from 'vue'

interface ToastAction {
  label: string
  href?: string
  onClick?: () => void
}

interface ToastOptions {
  message: string
  variant?: 'success' | 'error' | 'info'
  duration?: number
  action?: ToastAction
}

interface ToastState {
  visible: boolean
  message: string
  variant: 'success' | 'error' | 'info'
  action: ToastAction | null
}

/**
 * Fallback toast implementation for use when app doesn't provide useToast
 */
const useFallbackToast = () => {
  const toast = useState<ToastState>('emailLayerToast', () => ({
    visible: false,
    message: '',
    variant: 'success' as const,
    action: null
  }))
  
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  
  const show = (options: ToastOptions) => {
    if (timeoutId) clearTimeout(timeoutId)
    
    toast.value = {
      visible: true,
      message: options.message,
      variant: options.variant || 'success',
      action: options.action || null
    }
    
    if (options.duration !== 0) {
      timeoutId = setTimeout(() => {
        toast.value.visible = false
      }, options.duration || 4000)
    }
  }
  
  const hide = () => {
    if (timeoutId) clearTimeout(timeoutId)
    toast.value.visible = false
  }
  
  const success = (message: string, action?: ToastAction) => 
    show({ message, variant: 'success', action })
  
  const error = (message: string) => 
    show({ message, variant: 'error' })
    
  const info = (message: string, action?: ToastAction) => 
    show({ message, variant: 'info', action })
  
  onUnmounted(() => {
    if (timeoutId) clearTimeout(timeoutId)
  })
  
  return { 
    toast: readonly(toast), 
    show, 
    hide, 
    success, 
    error, 
    info 
  }
}

/**
 * Try to get app's useToast composable safely
 */
const tryUseAppToast = () => {
  try {
    const nuxtApp = useNuxtApp()
    // Check if useToast is available in the app
    if (typeof nuxtApp.$useToast === 'function') {
      return nuxtApp.$useToast()
    }
    return null
  } catch {
    return null
  }
}

/**
 * Email layer toast composable with fallback
 * Tries to use app's useToast first, falls back to internal implementation
 */
export const useEmailToast = () => {
  const appToast = tryUseAppToast()
  
  if (appToast) {
    return appToast
  }
  
  return useFallbackToast()
}
