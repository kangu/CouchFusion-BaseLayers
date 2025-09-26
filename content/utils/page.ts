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
