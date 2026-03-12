import { computed } from 'vue'

/**
 * Resolves optional `data-prop-id` values for content components.
 * The attribute is enabled only inside inline preview iframe mode
 * (`?inline-preview=1`) so production rendering stays clean.
 */
export const useContentPropId = () => {
  const route = useRoute()

  const isInlinePreview = computed(() => {
    return route.query['inline-preview'] !== undefined
  })

  const resolveContentPropId = (propPath: string | null | undefined) => {
    if (!isInlinePreview.value) {
      return null
    }

    const normalized = typeof propPath === 'string' ? propPath.trim() : ''
    return normalized.length > 0 ? normalized : null
  }

  return {
    isInlinePreview,
    resolveContentPropId
  }
}
