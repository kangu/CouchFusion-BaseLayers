import { onBeforeUnmount, onMounted } from 'vue'
import { useContentPagesStore } from '#content/app/stores/pages'
import { normalizePagePath } from '#content/utils/page'
import type { MinimalContentDocument } from '#content/app/utils/contentBuilder'

interface LiveUpdatePayload {
  path: string
  document: MinimalContentDocument
}

interface LiveUpdateMessage {
  type: 'live_updates'
  payload?: LiveUpdatePayload
}

interface BuilderFocusPayload {
  path: string
  uid: string
  mode?: 'flash' | 'lock' | 'clear'
}

interface BuilderFocusMessage {
  type: 'builder_focus'
  payload?: BuilderFocusPayload
}

const isLiveUpdateMessage = (value: unknown): value is LiveUpdateMessage => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Record<string, any>
  if (candidate.type !== 'live_updates') {
    return false
  }

  if (!candidate.payload || typeof candidate.payload !== 'object') {
    return false
  }

  if (typeof candidate.payload.path !== 'string') {
    return false
  }

  return Boolean(candidate.payload.document && typeof candidate.payload.document === 'object')
}

const isBuilderFocusMessage = (value: unknown): value is BuilderFocusMessage => {
  if (!value || typeof value !== 'object') {
    return false
  }
  const candidate = value as Record<string, any>
  if (candidate.type !== 'builder_focus') {
    return false
  }
  if (!candidate.payload || typeof candidate.payload !== 'object') {
    return false
  }
  return typeof candidate.payload.uid === 'string' && typeof candidate.payload.path === 'string'
}

const isInlinePreview = (): boolean => {
  if (typeof window === 'undefined') {
    return false
  }
  try {
    const params = new URLSearchParams(window.location.search)
    return params.has('inline-preview')
  } catch {
    return false
  }
}

let highlightOverlay: HTMLDivElement | null = null

const ensureHighlightOverlay = (): HTMLDivElement => {
  if (highlightOverlay) {
    return highlightOverlay
  }

  const overlay = document.createElement('div')
  overlay.setAttribute('data-builder-highlight', 'true')
  overlay.style.position = 'absolute'
  overlay.style.border = '6px solid #2563eb'
  overlay.style.background = 'rgba(37, 99, 235, 0.08)'
  overlay.style.pointerEvents = 'none'
  overlay.style.zIndex = '9999'
  overlay.style.boxShadow = '0 0 0 6px rgba(37, 99, 235, 0.25)'
  overlay.style.transition = 'opacity 120ms ease'
  overlay.style.opacity = '0'
  document.body.appendChild(overlay)
  highlightOverlay = overlay
  return overlay
}

const showHighlight = (target: HTMLElement) => {
  const overlay = ensureHighlightOverlay()
  const rect = target.getBoundingClientRect()
  const top = rect.top + window.scrollY
  const left = rect.left + window.scrollX
  overlay.style.width = `${rect.width}px`
  overlay.style.height = `${rect.height}px`
  overlay.style.transform = `translate(${left}px, ${top}px)`
  overlay.style.opacity = '1'
}

const clearHighlight = () => {
  if (highlightOverlay) {
    highlightOverlay.style.opacity = '0'
  }
}

const applyElementShadow = (
  element: HTMLElement,
  mode: 'flash' | 'lock' | 'clear' = 'flash'
) => {
  const flashClass = 'builder-highlight-flash'
  const lockClass = 'builder-highlight-lock'

  element.classList.remove(flashClass)
  element.classList.remove(lockClass)

  if (mode === 'clear') {
    return
  }

  if (mode === 'lock') {
    element.classList.add(lockClass)
    return
  }

  // flash
  element.classList.add(flashClass)
  // remove after animation
  window.setTimeout(() => element.classList.remove(flashClass), 900)
}

const ensureHighlightStyles = () => {
  if (document.getElementById('builder-highlight-styles')) {
    return
  }
  const style = document.createElement('style')
  style.id = 'builder-highlight-styles'
  style.textContent = `
.builder-highlight-flash {
  box-shadow: inset 0 0 0 9px rgba(37, 99, 235, 0.85), 0 0 0 6px rgba(37, 99, 235, 0.25);
  transition: box-shadow 0.2s ease;
}
.builder-highlight-lock {
  box-shadow: inset 0 0 0 9px rgba(37, 99, 235, 0.85), 0 0 0 6px rgba(37, 99, 235, 0.25);
}
  `
  document.head.appendChild(style)
}

export const useContentLiveUpdates = (): void => {
  if (import.meta.server) {
    return
  }

  const contentStore = useContentPagesStore()
  let pendingScroll: { x: number; y: number } | null = null

  const scheduleScrollRestore = (coords: { x: number; y: number }) => {
    if (typeof window === 'undefined') {
      return
    }

    let attempts = 6

    const attemptRestore = () => {
      if (typeof window === 'undefined') {
        return
      }

      window.scrollTo({
        left: coords.x,
        top: coords.y
      })

      const aligned =
        Math.abs(window.scrollX - coords.x) <= 1 &&
        Math.abs(window.scrollY - coords.y) <= 1

      attempts -= 1

      if (!aligned && attempts > 0) {
        const delay = attempts <= 3 ? 48 : 0
        if (delay > 0) {
          setTimeout(() => requestAnimationFrame(attemptRestore), delay)
        } else {
          requestAnimationFrame(attemptRestore)
        }
      }
    }

    requestAnimationFrame(attemptRestore)
  }

  const handleMessage = (event: MessageEvent) => {
    const data = event.data

    const sameOrigin = typeof window === 'undefined' || !event.origin || event.origin === window.location.origin
    if (!sameOrigin) {
      return
    }

    if (isLiveUpdateMessage(data)) {
      try {
        const path = normalizePagePath(data.payload?.path ?? '/')
        const document = data.payload!.document

        if (document.path && normalizePagePath(document.path) !== path) {
          document.path = path
        }

        console.log('[content-live-updates] applying document', { path, document })

        if (typeof window !== 'undefined') {
          const currentPath = normalizePagePath(window.location.pathname || '/')
          if (currentPath === path) {
            pendingScroll = {
              x: window.scrollX,
              y: window.scrollY
            }
          } else {
            pendingScroll = null
          }
        }

        contentStore.applyLiveDocument(document)
        console.log('[content-live-updates] document applied', {
          path,
          summary: contentStore.getPage(path)
        })

        if (pendingScroll) {
          const coords = pendingScroll
          pendingScroll = null
          scheduleScrollRestore(coords)
        }
      } catch (error) {
        console.error('Failed to apply live content update:', error)
      }
      return
    }

    if (isBuilderFocusMessage(data) && isInlinePreview()) {
      try {
        const targetPath = normalizePagePath(data.payload?.path ?? '/')
        if (typeof window !== 'undefined') {
          const currentPath = normalizePagePath(window.location.pathname || '/')
          if (currentPath !== targetPath) {
            return
          }
        }

        const uid = data.payload!.uid
        const mode = data.payload!.mode ?? 'flash'
        const target = document.querySelector<HTMLElement>(
          `[data-builder-uid="${uid}"]`
        )

        if (!target) {
          clearHighlight()
          return
        }

        target.scrollIntoView({ block: 'center', behavior: 'smooth' })
        ensureHighlightStyles()
        applyElementShadow(target, mode)
        showHighlight(target)
      } catch (error) {
        console.error('Failed to highlight builder node:', error)
      }
    }
  }

  onMounted(() => {
    window.addEventListener('message', handleMessage)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('message', handleMessage)
  })
}
