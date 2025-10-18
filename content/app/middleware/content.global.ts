import { defineNuxtRouteMiddleware, createError, abortNavigation, useAppConfig } from '#imports'
import { useContentPagesStore } from '#content/app/stores/pages'

const reservedPrefixes = [
    '/.well-known', // Browser / platform discovery endpoints should bypass content lookups.
    '/_nuxt', // Nuxt internal assets and manifests.
    '/api', // Server API endpoints are handled separately via Nitro routes.
    '/assets', // Uploaded/static asset proxy paths.
    '/favicon', // Favicon requests (various extensions) should not trigger content loads.
    '/__' // Dev tools or internal diagnostic routes (e.g. __nuxt_error).
]

const normalisePrefix = (value: string): string | null => {
    if (typeof value !== 'string') {
        return null
    }

    const trimmed = value.trim()
    if (!trimmed.startsWith('/')) {
        return null
    }

    if (trimmed === '/') {
        return null
    }

    return trimmed.replace(/\/+$/, '')
}

const buildIgnoredPrefixes = (): string[] => {
    const appConfig = useAppConfig()
    const appDefined = Array.isArray(appConfig?.content?.ignoredPrefixes)
        ? appConfig.content.ignoredPrefixes
        : []

    const combined = new Set<string>(reservedPrefixes)

    for (const prefix of appDefined) {
        const normalised = typeof prefix === 'string' ? normalisePrefix(prefix) : null
        if (normalised) {
            combined.add(normalised)
        }
    }

    return Array.from(combined)
}

const isContentRoute = (path: string, ignoredPrefixes: string[]) => {
    if (!path || !path.startsWith('/')) {
        // Guard for undefined/empty paths or hash-style navigation.
        return false
    }

    if (ignoredPrefixes.some((prefix) => path.startsWith(prefix))) {
        // Skip reserved prefixes defined above to avoid logging noise and unnecessary fetches.
        return false
    }

    if (path.includes('?') || path.includes('#')) {
        // Ignore query/hash-only navigation such as tracking pixels or scroll positions.
        return false
    }

    const lastSegment = path.split('/').pop() ?? ''
    if ((!lastSegment || lastSegment.includes('.')) && (path !== '/')) {
        // Treat empty/extension segments (e.g. ".json", ".ico") as non-content resources.
        return false
    }

    return true
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
