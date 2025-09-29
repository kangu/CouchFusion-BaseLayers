import { createError } from 'h3'
import { normalizePagePath } from '#content/utils/page'
import type { ContentPageDocument } from '#content/types/content-page'
import {
    clonePlain,
    deriveStem,
    contentIdFromPath,
    ensureLayout,
    ensureMinimalBody
} from '#content/utils/page-documents'

export { contentIdFromPath } from '#content/utils/page-documents'

export interface StoredContentPageDocument extends ContentPageDocument {
    createdAt: string
    updatedAt: string
    type?: string
}

export const sanitiseIncomingDocument = (
    payload: any,
    options: { existing?: any; isCreate: boolean }
): StoredContentPageDocument => {
    if (!payload || typeof payload !== 'object') {
        throw createError({
            statusCode: 400,
            statusMessage: 'Invalid payload: document is required'
        })
    }

    const existing = options.existing || {}
    const raw = clonePlain(payload)
    const now = new Date().toISOString()

    const normalizedPath = normalizePagePath(raw.path ?? existing.path ?? payload.path ?? '/')
    const id = raw._id ?? existing._id ?? contentIdFromPath(normalizedPath)
    const layout = raw.layout && typeof raw.layout === 'object' ? ensureLayout(raw.layout) : ensureLayout(existing.layout)
    const body = raw.body && typeof raw.body === 'object' ? ensureMinimalBody(raw.body) : (existing.body ? ensureMinimalBody(existing.body) : { type: 'minimal', value: [] })
    const seo = raw.seo && typeof raw.seo === 'object'
        ? {
            title: raw.seo.title ?? existing.seo?.title ?? raw.title ?? existing.title ?? 'Page title',
            description: raw.seo.description ?? existing.seo?.description ?? 'SEO description.'
        }
        : existing.seo || {
            title: raw.title ?? existing.title ?? 'Page title',
            description: 'SEO description.'
        }

    const meta = raw.meta && typeof raw.meta === 'object'
        ? clonePlain(raw.meta)
        : (existing.meta && typeof existing.meta === 'object' ? clonePlain(existing.meta) : {})

    return {
        _id: id,
        _rev: options.isCreate ? undefined : existing._rev,
        title: raw.title ?? existing.title ?? 'Page title',
        layout,
        body,
        path: normalizedPath,
        seo,
        stem: raw.stem ?? existing.stem ?? deriveStem(normalizedPath),
        meta,
        extension: raw.extension ?? existing.extension ?? 'md',
        navigation: typeof raw.navigation === 'boolean' ? raw.navigation : (typeof existing.navigation === 'boolean' ? existing.navigation : true),
        createdAt: options.isCreate ? now : existing.createdAt ?? now,
        updatedAt: now,
        type: 'page'
    }
}
