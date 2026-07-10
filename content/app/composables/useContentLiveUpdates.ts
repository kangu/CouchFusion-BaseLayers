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
  locale?: string | null
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
  propPath?: string
  scrollBlock?: ScrollLogicalPosition
  forceScroll?: boolean
}

/**
 * PostMessage envelope for focus/highlight synchronization.
 */
interface BuilderFocusMessage {
  type: 'builder_focus'
  payload?: BuilderFocusPayload
}

interface BuilderFontPreviewPayload {
  sansFamily: string
  displayFamily: string
  cssHrefs: string[]
}

interface BuilderFontPreviewMessage {
  type: 'builder_font_preview'
  payload?: BuilderFontPreviewPayload
}

interface BuilderThemePreviewPayload {
  tokens: Record<string, string>
}

interface BuilderThemePreviewMessage {
  type: 'builder_theme_preview'
  payload?: BuilderThemePreviewPayload
}

/**
 * Payload emitted from inline preview when a prop-annotated element is clicked.
 */
interface InlinePropClickPayload {
  path: string
  uid: string
  propPath: string
  sectionId?: string
  hint?: {
    text?: string
    href?: string
    src?: string
    alt?: string
    ariaLabel?: string
    title?: string
  }
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

const isBuilderFontPreviewMessage = (value: unknown): value is BuilderFontPreviewMessage => {
  if (!value || typeof value !== 'object') {
    return false
  }
  const candidate = value as Record<string, any>
  if (candidate.type !== 'builder_font_preview') {
    return false
  }
  if (!candidate.payload || typeof candidate.payload !== 'object') {
    return false
  }
  return (
    typeof candidate.payload.sansFamily === 'string' &&
    typeof candidate.payload.displayFamily === 'string' &&
    Array.isArray(candidate.payload.cssHrefs)
  )
}

const isBuilderThemePreviewMessage = (value: unknown): value is BuilderThemePreviewMessage => {
  if (!value || typeof value !== 'object') {
    return false
  }
  const candidate = value as Record<string, any>
  if (candidate.type !== 'builder_theme_preview') {
    return false
  }
  if (!candidate.payload || typeof candidate.payload !== 'object') {
    return false
  }
  return candidate.payload.tokens && typeof candidate.payload.tokens === 'object'
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

/**
 * Emits clicked prop marker metadata to the parent inline editor.
 */
const notifyInlinePropClick = (payload: InlinePropClickPayload) => {
  if (typeof window === 'undefined' || !isInlinePreview()) {
    return
  }

  try {
    window.parent?.postMessage(
      {
        type: 'content_inline_prop_click',
        payload
      },
      '*'
    )
  } catch {
    // noop
  }
}

const collectInlineHint = (target: Element): InlinePropClickPayload['hint'] => {
  const asHTMLElement = target instanceof HTMLElement ? target : null
  const asAnchor = target instanceof HTMLAnchorElement ? target : null
  const asImage = target instanceof HTMLImageElement ? target : null

  const text = (target.textContent || '').trim()
  const href = asAnchor
    ? asAnchor.getAttribute('href')?.trim() || asAnchor.href.trim()
    : ''
  const src = asImage
    ? asImage.getAttribute('src')?.trim() || asImage.src.trim()
    : ''
  const alt = asImage?.alt?.trim() || asHTMLElement?.getAttribute('alt')?.trim() || ''
  const ariaLabel = asHTMLElement?.getAttribute('aria-label')?.trim() || ''
  const title = asHTMLElement?.getAttribute('title')?.trim() || ''

  const payload: InlinePropClickPayload['hint'] = {}
  if (text) payload.text = text
  if (href) payload.href = href
  if (src) payload.src = src
  if (alt) payload.alt = alt
  if (ariaLabel) payload.ariaLabel = ariaLabel
  if (title) payload.title = title
  return Object.keys(payload).length ? payload : undefined
}

const toMarkerElement = (value: Element | null): HTMLElement | null => {
  if (!(value instanceof HTMLElement)) {
    return null
  }
  return value.matches('[data-prop-id]')
    ? value
    : value.closest<HTMLElement>('[data-prop-id]')
}

const selectPreferredMarker = (
  directMarker: HTMLElement | null,
  fallbackMarkers: HTMLElement[]
): HTMLElement | null => {
  if (!directMarker) {
    return fallbackMarkers[0] ?? null
  }

  // If clicking an <img> that sits inside another prop marker (e.g. <picture>),
  // prefer the ancestor marker so image clicks map to image props instead of alt text.
  if (directMarker.tagName === 'IMG') {
    const ancestorMarker = directMarker.parentElement?.closest<HTMLElement>('[data-prop-id]')
    if (ancestorMarker && ancestorMarker !== directMarker) {
      return ancestorMarker
    }
  }

  return directMarker
}

const FOLLOW_GESTURE_WINDOW_MS = 420
const FOLLOW_GESTURE_MAX_DISTANCE_PX = 12

type PendingFollowGesture = {
  id: string
  timestamp: number
  clientX: number
  clientY: number
}

let pendingFollowGesture: PendingFollowGesture | null = null

const shouldAllowNaturalFollow = (event: MouseEvent, target: Element): boolean => {
  const followTarget = target.closest<HTMLElement>('[data-prop-follow-link-id]')
  if (!followTarget) {
    pendingFollowGesture = null
    return false
  }

  // Preserve native browser semantics for opening in a new tab/window.
  if (event.metaKey || event.ctrlKey) {
    pendingFollowGesture = null
    return true
  }

  const followId = followTarget.getAttribute('data-prop-follow-link-id')?.trim()
  if (!followId) {
    pendingFollowGesture = null
    return false
  }

  const now = Date.now()
  const previous = pendingFollowGesture
  pendingFollowGesture = {
    id: followId,
    timestamp: now,
    clientX: event.clientX,
    clientY: event.clientY
  }

  if (!previous || previous.id !== followId) {
    return false
  }

  const elapsed = now - previous.timestamp
  const movedX = Math.abs(event.clientX - previous.clientX)
  const movedY = Math.abs(event.clientY - previous.clientY)
  const maxMoved = Math.max(movedX, movedY)

  if (elapsed > FOLLOW_GESTURE_WINDOW_MS || maxMoved > FOLLOW_GESTURE_MAX_DISTANCE_PX) {
    return false
  }

  pendingFollowGesture = null
  return true
}

let highlightOverlay: HTMLDivElement | null = null
let highlightClearTimer: ReturnType<typeof setTimeout> | null = null
let highlightedElement: HTMLElement | null = null
const HIGHLIGHT_FLASH_DURATION_MS = 900
const SCROLL_SETTLE_FRAMES = 4
const SCROLL_SETTLE_MAX_WAIT_MS = 1400
const SCROLL_SETTLE_DELTA_PX = 1

const clearPendingHighlightTimer = () => {
  if (!highlightClearTimer) {
    return
  }
  clearTimeout(highlightClearTimer)
  highlightClearTimer = null
}

const clearElementShadow = (element: HTMLElement | null) => {
  if (!element) {
    return
  }
  element.classList.remove('builder-highlight-flash')
  element.classList.remove('builder-highlight-lock')
}

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

const findFocusVisibilityTarget = (
  componentTarget: HTMLElement,
  propPath: string | null | undefined
): HTMLElement => {
  const normalizedPropPath = typeof propPath === 'string' ? propPath.trim() : ''
  if (!normalizedPropPath) {
    return componentTarget
  }

  const propTargets = Array.from(
    componentTarget.querySelectorAll<HTMLElement>('[data-prop-id]')
  )
  const exactTarget = propTargets.find((element) => {
    return element.getAttribute('data-prop-id')?.trim() === normalizedPropPath
  })

  return exactTarget ?? componentTarget
}

const shouldScrollFocusTargetIntoView = (
  componentTarget: HTMLElement,
  propPath: string | null | undefined
): boolean => {
  const visibilityTarget = findFocusVisibilityTarget(componentTarget, propPath)
  if (!shouldScrollTargetIntoView(visibilityTarget)) {
    return false
  }

  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0
  const componentRect = componentTarget.getBoundingClientRect()
  const componentIsOversized = viewportHeight > 0 && componentRect.height > viewportHeight * 0.85
  if (!componentIsOversized) {
    return true
  }

  const visibleTop = Math.max(componentRect.top, 0)
  const visibleBottom = Math.min(componentRect.bottom, viewportHeight)
  const visibleHeight = Math.max(0, visibleBottom - visibleTop)

  // Oversized sections can be actively edited while only part of the component is visible.
  // Avoid jumping the preview unless less than a useful viewport slice is visible.
  return visibleHeight < Math.min(240, viewportHeight * 0.35)
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
  overlay.style.position = 'fixed'
  overlay.style.top = '0'
  overlay.style.left = '0'
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
  clearPendingHighlightTimer()
  if (highlightedElement && highlightedElement !== target) {
    clearElementShadow(highlightedElement)
  }
  highlightedElement = target
  const overlay = ensureHighlightOverlay()
  const rect = target.getBoundingClientRect()
  const top = rect.top
  const left = rect.left
  overlay.style.width = `${rect.width}px`
  overlay.style.height = `${rect.height}px`
  overlay.style.transform = `translate(${left}px, ${top}px)`
  overlay.style.opacity = '1'
}

/**
 * Hides the persistent highlight overlay without removing the node.
 */
const clearHighlight = () => {
  clearPendingHighlightTimer()
  if (highlightOverlay) {
    highlightOverlay.style.opacity = '0'
  }
  clearElementShadow(highlightedElement)
  highlightedElement = null
}

const scheduleHighlightClear = () => {
  clearPendingHighlightTimer()

  highlightClearTimer = setTimeout(() => {
    highlightClearTimer = null
    clearHighlight()
  }, HIGHLIGHT_FLASH_DURATION_MS)
}

const waitForScrollToSettle = async () => {
  if (typeof window === 'undefined') {
    return
  }

  const startedAt = Date.now()
  let stableFrames = 0
  let lastX = window.scrollX
  let lastY = window.scrollY

  await new Promise<void>((resolve) => {
    const tick = () => {
      const currentX = window.scrollX
      const currentY = window.scrollY
      const moved =
        Math.abs(currentX - lastX) > SCROLL_SETTLE_DELTA_PX ||
        Math.abs(currentY - lastY) > SCROLL_SETTLE_DELTA_PX

      if (moved) {
        stableFrames = 0
      } else {
        stableFrames += 1
      }

      lastX = currentX
      lastY = currentY

      if (
        stableFrames >= SCROLL_SETTLE_FRAMES ||
        Date.now() - startedAt >= SCROLL_SETTLE_MAX_WAIT_MS
      ) {
        resolve()
        return
      }

      requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
  })
}

/**
 * Applies transient or persistent element shadow classes for focus feedback.
 */
const applyElementShadow = (
  element: HTMLElement,
  mode: 'flash' | 'lock' | 'clear' = 'flash'
) => {
  clearElementShadow(element)

  if (mode === 'clear') {
    return
  }

  if (mode === 'lock') {
    element.classList.add('builder-highlight-lock')
    return
  }

  element.classList.add('builder-highlight-flash')
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
  let focusRequestId = 0

  const ensureInlinePreviewFontLinks = (hrefs: string[]) => {
    const head = document.head || document.documentElement
    const normalizedHrefs = Array.from(
      new Set(
        hrefs
          .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
          .filter((entry) => entry.length > 0)
      )
    )

    const existingLinks = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[data-inline-preview-font="1"]')
    )

    for (const link of existingLinks) {
      if (!normalizedHrefs.includes(link.href)) {
        link.remove()
      }
    }

    for (const href of normalizedHrefs) {
      const alreadyPresent = existingLinks.some((link) => link.href === href)
      if (alreadyPresent) {
        continue
      }
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = href
      link.setAttribute('data-inline-preview-font', '1')
      head.appendChild(link)
    }
  }

  const applyInlinePreviewFontOverrides = (payload: BuilderFontPreviewPayload) => {
    const head = document.head || document.documentElement
    ensureInlinePreviewFontLinks(payload.cssHrefs ?? [])

    const escapeCss = (value: string) =>
      value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

    const sansFamily = escapeCss(payload.sansFamily.trim() || 'sans-serif')
    const displayFamily = escapeCss(payload.displayFamily.trim() || 'serif')

    const styleId = 'content-inline-preview-font-overrides'
    let styleTag = document.getElementById(styleId) as HTMLStyleElement | null
    if (!styleTag) {
      styleTag = document.createElement('style')
      styleTag.id = styleId
      head.appendChild(styleTag)
    }

    styleTag.textContent = [
      ':root {',
      `  --font-sans: '${sansFamily}', sans-serif !important;`,
      `  --font-display: '${displayFamily}', serif !important;`,
      '}',
      'html, body {',
      '  font-family: var(--font-sans) !important;',
      '}',
      '',
    ].join('\n')
  }

  const applyInlinePreviewThemeOverrides = (payload: BuilderThemePreviewPayload) => {
    const head = document.head || document.documentElement
    const styleId = 'content-inline-preview-theme-overrides'
    let styleTag = document.getElementById(styleId) as HTMLStyleElement | null
    if (!styleTag) {
      styleTag = document.createElement('style')
      styleTag.id = styleId
      head.appendChild(styleTag)
    }

    const entries = Object.entries(payload.tokens ?? {})
      .map(([key, value]) => {
        if (typeof key !== 'string' || !/^--[a-z0-9-]+$/i.test(key)) {
          return null
        }
        const normalizedValue =
          typeof value === 'string' ? value.trim() : String(value ?? '').trim()
        if (!normalizedValue) {
          return null
        }

        const sanitizedValue = normalizedValue.replace(/[\r\n{}]/g, ' ')
        return `  ${key}: ${sanitizedValue} !important;`
      })
      .filter((entry): entry is string => Boolean(entry))

    if (entries.length === 0) {
      styleTag.textContent = ''
      return
    }

    styleTag.textContent = [
      ':root {',
      ...entries,
      '}',
      '',
    ].join('\n')
  }

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
  const handleMessage = async (event: MessageEvent) => {
    const data = event.data

    const sameOrigin = typeof window === 'undefined' || !event.origin || event.origin === window.location.origin
    if (!sameOrigin) {
      return
    }

    if (isLiveUpdateMessage(data)) {
      try {
        // Prevent stale focus overlay geometry from affecting preview UX
        // while the document is being replaced.
        clearHighlight()

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

        contentStore.applyLiveDocument(document, {
          locale: data.payload?.locale ?? null
        })
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

    if (isBuilderFontPreviewMessage(data) && isInlinePreview()) {
      try {
        applyInlinePreviewFontOverrides(data.payload!)
      } catch (error) {
        console.error('Failed to apply inline font preview override:', error)
      }
      return
    }

    if (isBuilderThemePreviewMessage(data) && isInlinePreview()) {
      try {
        applyInlinePreviewThemeOverrides(data.payload!)
      } catch (error) {
        console.error('Failed to apply inline theme preview override:', error)
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
        const requestId = ++focusRequestId

        if (!target) {
          clearHighlight()
          return
        }

        const propPath = data.payload!.propPath ?? ''
        const scrollBlock = data.payload!.scrollBlock ?? 'center'
        const forceScroll = data.payload!.forceScroll === true
        const didTriggerScroll = forceScroll || shouldScrollFocusTargetIntoView(target, propPath)

        if (didTriggerScroll) {
          target.scrollIntoView({ block: scrollBlock, behavior: 'smooth' })
          await waitForScrollToSettle()
        }

        if (requestId !== focusRequestId) {
          return
        }

        if (mode === 'clear') {
          clearHighlight()
          applyElementShadow(target, mode)
          return
        }

        if (forceScroll || shouldScrollFocusTargetIntoView(target, propPath)) {
          // Fallback for any late layout shifts that still require visibility alignment.
          target.scrollIntoView({ block: scrollBlock, behavior: 'smooth' })
        }
        ensureHighlightStyles()
        applyElementShadow(target, mode)
        showHighlight(target)
        scheduleHighlightClear()
      } catch (error) {
        console.error('Failed to highlight builder node:', error)
      }
    }

  }

  const handleInlinePreviewClick = (event: MouseEvent) => {
    if (!isInlinePreview()) {
      return
    }

    const target = event.target
    if (!(target instanceof Element)) {
      return
    }

    const interactiveControl = target.closest<HTMLElement>('button, [role="button"], input, select, textarea')
    if (interactiveControl && !interactiveControl.hasAttribute('data-prop-id')) {
      return
    }

    // Allow explicitly interactive controls to handle their own clicks in inline preview.
    if (target.closest('[data-inline-preview-interactive="true"]')) {
      return
    }

    if (shouldAllowNaturalFollow(event, target)) {
      return
    }

    const directMarker = target.closest<HTMLElement>('[data-prop-id]')
    const markersFromPoint: HTMLElement[] =
      typeof document.elementsFromPoint === 'function'
        ? Array.from(document.elementsFromPoint(event.clientX, event.clientY)).reduce<HTMLElement[]>(
            (acc, element) => {
              const marker = toMarkerElement(element)
              if (marker && !acc.includes(marker)) {
                acc.push(marker)
              }
              return acc
            },
            []
          )
        : []

    const marker = selectPreferredMarker(directMarker, markersFromPoint)
    const owner = (marker ?? target).closest<HTMLElement>('[data-builder-uid]')
    const uid = owner?.getAttribute('data-builder-uid')?.trim()
    if (!uid) {
      return
    }
    const rawPropPath = marker?.getAttribute('data-prop-id')?.trim() || ''
    const sectionOwner = (marker ?? target).closest<HTMLElement>('[data-section-id]')
    const sectionId = sectionOwner?.getAttribute('data-section-id')?.trim() || undefined
    const hint = collectInlineHint(target)

    // Controls with editable prop markers are editor targets in live preview.
    // Components must opt in with data-inline-preview-interactive to preserve
    // native behavior (for example, an accordion toggle).
    const preserveNativeInteraction = false
    if (!preserveNativeInteraction) {
      if (event.cancelable) {
        event.preventDefault()
      }
      event.stopPropagation()
    }

    notifyInlinePropClick({
      path: normalizePagePath(window.location.pathname || '/'),
      uid,
      propPath: rawPropPath,
      sectionId,
      hint
    })
  }

  onMounted(() => {
    window.addEventListener('message', handleMessage)
    document.addEventListener('click', handleInlinePreviewClick, true)
    notifyInlinePreviewReady()
  })

  onBeforeUnmount(() => {
    window.removeEventListener('message', handleMessage)
    document.removeEventListener('click', handleInlinePreviewClick, true)
    clearPendingHighlightTimer()
    clearElementShadow(highlightedElement)
    highlightedElement = null
    if (highlightOverlay) {
      highlightOverlay.remove()
      highlightOverlay = null
    }
  })
}
