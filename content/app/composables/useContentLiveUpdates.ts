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

    if (!isLiveUpdateMessage(data)) {
      return
    }

    if (event.origin && typeof window !== 'undefined') {
      const currentOrigin = window.location.origin
      if (event.origin !== currentOrigin) {
        return
      }
    }

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
  }

  onMounted(() => {
    window.addEventListener('message', handleMessage)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('message', handleMessage)
  })
}
