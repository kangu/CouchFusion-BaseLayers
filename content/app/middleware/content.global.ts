import { defineNuxtRouteMiddleware, createError, abortNavigation, useAppConfig } from '#imports'
import { useContentPagesStore } from '#content/app/stores/pages'
import { resolveIgnoredPrefixes, isContentRoute } from '#content/utils/content-route'

const buildIgnoredPrefixes = (): string[] => {
    const appConfig = useAppConfig()
    return resolveIgnoredPrefixes(appConfig?.content)
}

export default defineNuxtRouteMiddleware(async (to, from) => {
    if (import.meta.client && (!from || (from.path === to.path))) {
        // Skip duplicate client execution during initial hydration; SSR already fetched the page.
        return
    }

    const ignoredPrefixes = buildIgnoredPrefixes()

    if (!isContentRoute(to.path, ignoredPrefixes)) {
        return
    }

    const store = useContentPagesStore()

    try {
        await store.fetchPage(to.path)
    } catch (error: any) {
        if (error?.statusCode === 404) {
            console.warn('Content page not found, triggering 404:', to.path)
            return abortNavigation(createError({
                statusCode: 404,
                statusMessage: 'Content page not found'
            }))
        }

        console.error('Content middleware fetch error:', error)
    }
})
