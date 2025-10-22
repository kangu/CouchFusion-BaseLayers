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

const normalisePrefixList = (input: any): string[] => {
    if (!Array.isArray(input)) {
        return []
    }

    return input
        .map((prefix) => normaliseContentPrefix(prefix))
        .filter((value): value is string => Boolean(value))
}

export interface ResolveIgnoredPrefixesOptions {
    includeAuto?: boolean
    includeManual?: boolean
    includeMerged?: boolean
}

export const resolveIgnoredPrefixes = (
    appConfigContent: Record<string, any> | undefined | null,
    options: ResolveIgnoredPrefixesOptions = {}
): string[] => {
    const {
        includeAuto = true,
        includeManual = true,
        includeMerged = true
    } = options

    const combined = new Set<string>(RESERVED_CONTENT_PREFIXES)

    if (includeManual) {
        const manual = normalisePrefixList(
            appConfigContent?.manualIgnoredPrefixes ??
            appConfigContent?.manualPrefixes ??
            []
        )

        for (const prefix of manual) {
            combined.add(prefix)
        }
    }

    if (includeAuto) {
        const auto = normalisePrefixList(appConfigContent?.autoIgnoredPrefixes ?? [])
        for (const prefix of auto) {
            combined.add(prefix)
        }
    }

    if (includeMerged) {
        const merged = normalisePrefixList(appConfigContent?.ignoredPrefixes ?? [])
        for (const prefix of merged) {
            combined.add(prefix)
        }
    }

    return Array.from(combined).sort((a, b) => a.localeCompare(b))
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
