import { onBeforeUnmount, onMounted } from 'vue'
import { useContentPagesStore } from '#content/app/stores/pages'
import { normalizePagePath } from '#content/utils/page'
import type { MinimalContentDocument } from '#content/app/utils/contentBuilder'

/**
 * Payload used by the inline editor to push a full minimal document snapshot
 * into the preview iframe.
 */
interface LiveUpdatePayload {
  path: string
  document: MinimalContentDocument
}

/**
 * PostMessage envelope for live document synchronization.
 */
interface LiveUpdateMessage {
  type: 'live_updates'
  payload?: LiveUpdatePayload
}

/**
 * Payload used by the builder to request visual focus/highlight for one node
 * in the preview iframe.
 */
interface BuilderFocusPayload {
  path: string
  uid: string
  mode?: 'flash' | 'lock' | 'clear'
}

/**
 * PostMessage envelope for focus/highlight synchronization.
 */
interface BuilderFocusMessage {
  type: 'builder_focus'
  payload?: BuilderFocusPayload
}

/**
 * Narrow unknown postMessage data to a valid live-update message.
 */
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

/**
 * Narrow unknown postMessage data to a valid focus message.
 */
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

/**
 * Inline preview mode is enabled when the iframe URL contains `inline-preview`.
 * The composable only applies focus-specific behavior in this mode.
 */
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

/**
 * Handshake message emitted from the preview iframe to the parent inline editor.
 * This signals that the message listener is mounted and ready to receive
 * `live_updates` and `builder_focus` messages.
 */
const notifyInlinePreviewReady = () => {
  if (typeof window === 'undefined' || !isInlinePreview()) {
    return
  }

  try {
    const path = normalizePagePath(window.location.pathname || '/')
    window.parent?.postMessage(
      {
        type: 'content_inline_preview_ready',
        payload: { path },
      },
      '*'
    )
  } catch {
    // noop
  }
}

let highlightOverlay: HTMLDivElement | null = null
/**
 * Scroll only when the target is sufficiently outside the viewport.
 * Example: `0.6` means at least 60% of the element is out of view.
 */
const MAX_OUT_OF_VIEW_RATIO_BEFORE_SCROLL = 0.6

/**
 * Computes element visibility within the current viewport and returns whether
 * auto-scroll should be triggered for focus.
 */
const shouldScrollTargetIntoView = (target: HTMLElement): boolean => {
  if (typeof window === 'undefined') {
    return false
  }

  const rect = target.getBoundingClientRect()
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0

  if (viewportWidth <= 0 || viewportHeight <= 0) {
    return false
  }

  const elementArea = Math.max(rect.width, 0) * Math.max(rect.height, 0)
  if (elementArea <= 0) {
    return false
  }

  const intersectionWidth = Math.max(
    0,
    Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0)
  )
  const intersectionHeight = Math.max(
    0,
    Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0)
  )
  const visibleArea = intersectionWidth * intersectionHeight
  const visibleRatio = visibleArea / elementArea
  const outOfViewRatio = 1 - visibleRatio

  return outOfViewRatio > MAX_OUT_OF_VIEW_RATIO_BEFORE_SCROLL
}

/**
 * Creates (once) and reuses a floating overlay rectangle that tracks the
 * focused element bounds. This is separate from element box-shadow effects.
 */
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

/**
 * Positions and displays the highlight overlay around the current target.
 */
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

/**
 * Hides the persistent highlight overlay without removing the node.
 */
const clearHighlight = () => {
  if (highlightOverlay) {
    highlightOverlay.style.opacity = '0'
  }
}

/**
 * Applies transient or persistent element shadow classes for focus feedback.
 */
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

/**
 * Injects focus CSS classes once into the preview document.
 */
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

/**
 * Keeps content preview in sync with builder changes and focus actions.
 *
 * Responsibilities:
 * - listen for postMessage live updates and patch the page store
 * - preserve scroll position during live content replacement
 * - apply node-level focus highlight when requested by the builder
 * - emit iframe readiness handshake for robust parent->iframe messaging
 */
export const useContentLiveUpdates = (): void => {
  if (import.meta.server) {
    return
  }

  const contentStore = useContentPagesStore()
  let pendingScroll: { x: number; y: number } | null = null

  /**
   * Live content replacement can nudge scroll unexpectedly.
   * Retry restoration for a few frames to survive async layout shifts.
   */
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

  /**
   * Unified postMessage entrypoint for both live document updates and
   * builder-driven focus events.
   */
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

        // console.log('[content-live-updates] applying document', { path, document })

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
        // console.log('[content-live-updates] document applied', {
        //   path,
        //   summary: contentStore.getPage(path)
        // })

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

        if (shouldScrollTargetIntoView(target)) {
          target.scrollIntoView({ block: 'center', behavior: 'smooth' })
        }
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
    notifyInlinePreviewReady()
  })

  onBeforeUnmount(() => {
    window.removeEventListener('message', handleMessage)
  })
}
