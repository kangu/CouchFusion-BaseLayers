import { computed, unref, watch, type MaybeRef } from 'vue'
import { normalizePagePath } from '#content/utils/page'
import { useContentPagesStore } from '#content/app/stores/pages'

interface UseContentPageOptions {
    immediate?: boolean
    force?: boolean
}

export function useContentPage(path: MaybeRef<string>, options: UseContentPageOptions = {}) {
    const store = useContentPagesStore()
    const immediate = options.immediate !== false

    const normalizedPath = computed(() => normalizePagePath(unref(path)))

    const pageState = computed(() => store.pages[normalizedPath.value])

    const page = computed(() => store.getPage(normalizedPath.value))
    const pending = computed(() => pageState.value?.pending ?? false)
    const error = computed(() => pageState.value?.error ?? null)

    const fetch = async (force = false) => {
        return store.fetchPage(normalizedPath.value, force ?? options.force ?? false)
    }

    if (immediate) {
        watch(
            () => normalizedPath.value,
            (value) => {
                if (!value) {
                    return
                }

                fetch(options.force ?? false).catch(() => {
                    // Errors are captured in store state; swallow here.
                })
            },
            { immediate: true }
        )
    }

    return {
        page,
        pending,
        error,
        refresh: (force = true) => fetch(force)
    }
}
