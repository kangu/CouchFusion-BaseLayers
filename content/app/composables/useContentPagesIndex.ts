import { computed } from 'vue'
import { useContentPagesStore } from '#content/app/stores/pages'

interface UseContentPagesOptions {
    immediate?: boolean
    force?: boolean
}

export function useContentPagesIndex(options: UseContentPagesOptions = {}) {
    const store = useContentPagesStore()
    const immediate = options.immediate !== false

    const pages = computed(() => store.index.data)
    const pending = computed(() => store.index.pending)
    const error = computed(() => store.index.error)

    const fetch = async (force = false) => {
        return store.fetchIndex(force ?? options.force ?? false)
    }

    if (immediate && !store.index.pending && !store.index.data.length) {
        fetch(options.force ?? false).catch(() => {
            // Store captures error state
        })
    }

    return {
        pages,
        pending,
        error,
        refresh: (force = true) => fetch(force)
    }
}
