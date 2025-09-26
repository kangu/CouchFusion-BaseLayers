import { normalizePagePath } from '#content/utils/page'
import type { MinimalContentDocument } from '#content/app/utils/contentBuilder'
import type { ContentPageDocument } from '#content/types/content-page'

export const clonePlain = <T>(value: T): T => {
    if (value === undefined || value === null) {
        return value
    }
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(value)
        } catch {}
    }
    try {
        return JSON.parse(JSON.stringify(value))
    } catch {
        return value
    }
}

export const deriveStem = (path: string): string => {
    const normalized = normalizePagePath(path)
    const trimmed = normalized.replace(/^\//, '')
    if (!trimmed) {
        return 'index'
    }
    const segments = trimmed.split('/')
    return segments[segments.length - 1] || 'index'
}

export const contentIdFromPath = (path: string): string => {
    const normalized = normalizePagePath(path)
    const trimmed = normalized.replace(/^\//, '')
    const segment = trimmed || 'index'
    return `content/${segment}`
}

export const ensureMinimalBody = (value: any): MinimalContentDocument['body'] => {
    if (value && typeof value === 'object' && value.type === 'minimal' && Array.isArray(value.value)) {
        return {
            type: 'minimal',
            value: clonePlain(value.value)
        }
    }
    return {
        type: 'minimal',
        value: []
    }
}

export const ensureLayout = (value: any): ContentPageDocument['layout'] => {
    if (value && typeof value === 'object') {
        return clonePlain(value as Record<string, any>)
    }
    return { spacing: 'none' }
}

export const minimalToContentDocument = (doc: MinimalContentDocument): ContentPageDocument => {
    const normalizedPath = normalizePagePath(doc.path ?? '/')
    return {
        _id: doc.id ?? contentIdFromPath(normalizedPath),
        title: doc.title ?? 'Page title',
        layout: ensureLayout(doc.layout),
        body: ensureMinimalBody(doc.body),
        path: normalizedPath,
        seo: {
            title: doc.seo?.title ?? doc.title ?? 'Page title',
            description: doc.seo?.description ?? 'SEO description.'
        },
        stem: doc.stem ?? deriveStem(normalizedPath),
        meta: doc.meta ? clonePlain(doc.meta) : {},
        extension: doc.extension ?? 'md',
        navigation: typeof doc.navigation === 'boolean' ? doc.navigation : true,
        createdAt: doc.createdAt ?? null,
        updatedAt: doc.updatedAt ?? null
    }
}

export const contentToMinimalDocument = (doc: ContentPageDocument): MinimalContentDocument => {
    return {
        id: doc._id ?? contentIdFromPath(doc.path),
        title: doc.title ?? 'Page title',
        layout: doc.layout ? clonePlain(doc.layout) : undefined,
        body: {
            type: 'minimal',
            value: clonePlain(doc.body?.value ?? [])
        },
        extension: doc.extension ?? 'md',
        meta: doc.meta ? clonePlain(doc.meta) : {},
        navigation: typeof doc.navigation === 'boolean' ? doc.navigation : true,
        path: doc.path,
        seo: {
            title: doc.seo?.title ?? doc.title ?? 'Page title',
            description: doc.seo?.description ?? 'SEO description.'
        },
        stem: doc.stem ?? deriveStem(doc.path)
    }
}
