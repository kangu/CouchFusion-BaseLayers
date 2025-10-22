export const RESERVED_CONTENT_PREFIXES = [
    '/.well-known',
    '/_nuxt',
    '/api',
    '/assets',
    '/favicon',
    '/__'
] as const

export const normaliseContentPrefix = (value: string | null | undefined): string | null => {
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

export const mergeIgnoredPrefixes = (manualPrefixes: Array<string | null | undefined>): string[] => {
    const combined = new Set<string>(RESERVED_CONTENT_PREFIXES)

    for (const prefix of manualPrefixes) {
        const normalised = normaliseContentPrefix(prefix)
        if (normalised) {
            combined.add(normalised)
        }
    }

    return Array.from(combined).sort((a, b) => a.localeCompare(b))
}

export const resolveIgnoredPrefixes = (appConfigContent: Record<string, any> | undefined | null): string[] => {
    const configured = Array.isArray(appConfigContent?.ignoredPrefixes)
        ? appConfigContent?.ignoredPrefixes
        : []

    return mergeIgnoredPrefixes(configured)
}

export const isContentRoute = (path: string, ignoredPrefixes: string[]): boolean => {
    if (!path || !path.startsWith('/')) {
        return false
    }

    if (ignoredPrefixes.some((prefix) => path.startsWith(prefix))) {
        return false
    }

    if (path.includes('?') || path.includes('#')) {
        return false
    }

    if (path !== '/') {
        const lastSegment = path.split('/').pop() ?? ''
        if (!lastSegment || lastSegment.includes('.')) {
            return false
        }
    }

    return true
}

