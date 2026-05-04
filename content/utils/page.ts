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

    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
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
        typeof requestUrl === 'string' && requestUrl.trim()
            ? requestUrl
            : typeof fullPath === 'string' && fullPath.trim()
                ? fullPath
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
