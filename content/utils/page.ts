/**
 * Normalize a page path to ensure it begins with a slash and has no trailing spaces.
 */
export function normalizePagePath(path: string): string {
    if (typeof path !== 'string') {
        return '/'
    }

    const trimmed = path.trim()

    if (!trimmed) {
        return '/'
    }

    const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`

    return normalized === '/' ? normalized : normalized.replace(/\/+$/, '')
}

/**
 * Resolve the browser-visible route path for content lookups.
 *
 * Nuxt's route.path may decode reserved characters during SSR. Content page ids
 * are generated from public URLs, so preserve the encoded path from fullPath
 * when it is available and strip query/hash before normalization.
 */
export function resolveContentRoutePath(path: string, fullPath?: string, requestUrl?: string): string {
    const sourcePath =
        typeof fullPath === 'string' && fullPath.trim()
            ? fullPath
            : typeof requestUrl === 'string' && requestUrl.trim()
                ? requestUrl
                : null

    if (sourcePath) {
        const [withoutHash] = sourcePath.split('#')
        const [withoutQuery] = withoutHash.split('?')
        if (withoutQuery.trim()) {
            return normalizePagePath(withoutQuery)
        }
    }

    return normalizePagePath(path)
}

/**
 * Resolve content-builder routes to the public page path used by runtime preview.
 *
 * The inline editor is available at `/builder/...` and `/k/...`, but the preview
 * iframe and content store must target the real content page route.
 */
export function resolveContentPreviewPath(path: string): string {
    const normalizedPath = normalizePagePath(path)
    const segments = normalizedPath.split('/').filter(Boolean)
    const firstSegment = segments[0]

    if (firstSegment !== 'builder' && firstSegment !== 'k') {
        return normalizedPath
    }

    const publicSegments = segments.slice(1)
    return publicSegments.length > 0 ? `/${publicSegments.join('/')}` : '/'
}

/**
 * Convert a normalized path to the CouchDB document id convention used by the content layer.
 */
export function pageIdFromPath(path: string): string {
    const normalizedPath = normalizePagePath(path)
    return `page-${normalizedPath}`
}

/**
 * Derive the public path from a CouchDB document id following the `page-` naming scheme.
 */
export function pathFromPageId(id: string): string {
    if (typeof id !== 'string') {
        return '/'
    }

    return id.startsWith('page-') ? id.slice('page-'.length) || '/' : id
}
