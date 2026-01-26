import { computed, unref, watch, type MaybeRef } from 'vue'
import { useHead } from '#imports'
import { normalizePagePath } from '#content/utils/page'
import { useContentPagesStore } from '#content/app/stores/pages'
import { normalizeSeoImage } from '#content/utils/page-documents'

interface UseContentPageOptions {
    immediate?: boolean
    force?: boolean
    head?: boolean
}

export function useContentPage(path: MaybeRef<string>, options: UseContentPageOptions = {}) {
    const store = useContentPagesStore()
    const immediate = options.immediate !== false
    const enableHead = options.head !== false

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

    if (enableHead) {
        useHead(() => {
            const current = page.value
            const image = normalizeSeoImage(
                current?.document?.seo?.image ?? current?.seoImage ?? null
            )

            const meta = []
            if (image) {
                meta.push(
                    { property: 'og:image', content: image },
                    { name: 'twitter:image', content: image },
                    { name: 'twitter:card', content: 'summary_large_image' }
                )
            }

            return {
                meta
            }
        })
    }

    return {
        page,
        pending,
        error,
        refresh: (force = true) => fetch(force)
    }
}
