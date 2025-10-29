import { defineNuxtRouteMiddleware, createError, abortNavigation, useAppConfig, useRuntimeConfig } from '#imports'
import { useContentPagesStore } from '#content/app/stores/pages'
import { resolveIgnoredPrefixes, isContentRoute, normaliseContentPrefix } from '#content/utils/content-route'

const buildIgnoredPrefixes = (): string[] => {
    const appConfig = useAppConfig()
    const prefixes = resolveIgnoredPrefixes(appConfig?.content)
    const runtimeConfig = useRuntimeConfig()
    const loginPath = normaliseContentPrefix(runtimeConfig.public?.authLoginPath)

    if (loginPath && !prefixes.includes(loginPath)) {
        prefixes.push(loginPath)
    }

    return prefixes
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
