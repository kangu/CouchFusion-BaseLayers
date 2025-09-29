import { defineNuxtRouteMiddleware } from '#imports'
import { useContentPagesStore } from '#content/app/stores/pages'

const reservedPrefixes = [
    '/.well-known', // Browser / platform discovery endpoints should bypass content lookups.
    '/_nuxt', // Nuxt internal assets and manifests.
    '/api', // Server API endpoints are handled separately via Nitro routes.
    '/assets', // Uploaded/static asset proxy paths.
    '/favicon', // Favicon requests (various extensions) should not trigger content loads.
    '/__' // Dev tools or internal diagnostic routes (e.g. __nuxt_error).
]

const isContentRoute = (path: string) => {
    if (!path || !path.startsWith('/')) {
        // Guard for undefined/empty paths or hash-style navigation.
        return false
    }

    if (reservedPrefixes.some((prefix) => path.startsWith(prefix))) {
        // Skip reserved prefixes defined above to avoid logging noise and unnecessary fetches.
        return false
    }

    if (path.includes('?') || path.includes('#')) {
        // Ignore query/hash-only navigation such as tracking pixels or scroll positions.
        return false
    }

    const lastSegment = path.split('/').pop() ?? ''
    if (!lastSegment || lastSegment.includes('.')) {
        // Treat empty/extension segments (e.g. ".json", ".ico") as non-content resources.
        return false
    }

    return true
}

export default defineNuxtRouteMiddleware(async (to) => {
    if (!isContentRoute(to.path)) {
        return
    }

    const store = useContentPagesStore()

    try {
        await store.fetchPage(to.path)
    } catch (error: any) {
        if (error?.statusCode !== 404) {
            console.error('Content middleware fetch error:', error)
        }
    }
})
