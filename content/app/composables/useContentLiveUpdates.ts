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

      contentStore.applyLiveDocument(document)
      console.log('[content-live-updates] document applied', {
        path,
        summary: contentStore.getPage(path)
      })
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
