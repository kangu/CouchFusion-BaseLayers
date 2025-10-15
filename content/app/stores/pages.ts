import { defineStore } from 'pinia'
import { normalizePagePath, pageIdFromPath } from '#content/utils/page'
import { createDocumentFromTree } from '#content/app/utils/contentBuilder'
import type { MinimalContentDocument } from '#content/app/utils/contentBuilder'
import type { ContentPageDocument, ContentPageSummary, ContentPageHistoryEntry } from '#content/types/content-page'
import {
    ensureMinimalBody,
    ensureLayout,
    deriveStem,
    clonePlain,
    minimalToContentDocument
} from '#content/utils/page-documents'

type Maybe<T> = T | null | undefined

type ContentPayload = { [key: string]: any }

interface FetchState<T> {
    pending: boolean
    error: string | null
    data: T
}

interface PagesState {
    index: FetchState<ContentPageSummary[]>
    pages: Record<string, FetchState<Maybe<ContentPageSummary>>>
    history: Record<string, FetchState<ContentPageHistoryEntry[]>>
}

const createEmptyFetchState = <T>(initialValue: T): FetchState<T> => ({
    pending: false,
    error: null,
    data: initialValue
})

const normalizeDocument = (
    payload: ContentPayload | null | undefined,
    fallback: { id: string; path: string; title: string | null; seoTitle: string | null; seoDescription: string | null }
): ContentPageDocument => {
    const raw = (payload && typeof payload === 'object') ? payload : {}
    const normalizedPath = normalizePagePath(raw.path ?? fallback.path)
    const seoTitle = raw.seo?.title ?? fallback.seoTitle ?? fallback.title ?? 'Page title'
    const seoDescription = raw.seo?.description ?? fallback.seoDescription ?? 'SEO description.'

    return {
        _id: raw._id ?? fallback.id,
        _rev: raw._rev,
        title: raw.title ?? fallback.title ?? 'Page title',
        layout: ensureLayout(raw.layout),
        body: ensureMinimalBody(raw.body),
        path: normalizedPath,
        seo: {
            title: seoTitle,
            description: seoDescription
        },
        stem: raw.stem ?? deriveStem(normalizedPath),
        meta: raw.meta && typeof raw.meta === 'object' ? clonePlain(raw.meta) : (raw.metadata && typeof raw.metadata === 'object' ? clonePlain(raw.metadata) : {}),
        extension: raw.extension ?? 'md',
        navigation: typeof raw.navigation === 'boolean' ? raw.navigation : true,
        createdAt: raw.createdAt ?? raw.created_at ?? null,
        updatedAt: raw.updatedAt ?? raw.updated_at ?? null
    }
}

const extractSummary = (payload: any): ContentPageSummary => {
    const rawDoc = payload?.document ?? payload?.doc ?? payload
    const path = payload?.path ?? rawDoc?.path ?? '/'
    const normalizedPath = normalizePagePath(path)
    const fallbackId = payload?.id ?? rawDoc?._id ?? pageIdFromPath(normalizedPath)
    const fallbackTitle = payload?.title ?? rawDoc?.title ?? null
    const fallbackSeoTitle = payload?.seoTitle ?? rawDoc?.seoTitle ?? rawDoc?.seo?.title ?? fallbackTitle
    const fallbackSeoDescription = payload?.seoDescription ?? rawDoc?.seoDescription ?? rawDoc?.seo?.description ?? null

    const document = normalizeDocument(rawDoc, {
        id: fallbackId,
        path: normalizedPath,
        title: fallbackTitle,
        seoTitle: fallbackSeoTitle,
        seoDescription: fallbackSeoDescription
    })

    const meta =
        payload?.meta ??
        document.meta ??
        {}

    const updatedAt = payload?.updatedAt ?? document.updatedAt ?? null

    return {
        id: document._id,
        path: document.path,
        title: document.title ?? null,
        seoTitle: document.seo.title,
        seoDescription: document.seo.description,
        meta,
        updatedAt,
        document
    }
}

const normalizeHistoryEntry = (payload: any, fallbackPath: string): ContentPageHistoryEntry => {
    const minimalDoc = payload?.document ?? payload?.doc ?? null
    const minimal: MinimalContentDocument = minimalDoc ? minimalDoc as MinimalContentDocument : {
        id: payload?.id ?? null,
        body: { type: 'minimal', value: [] },
        path: fallbackPath,
        title: payload?.title ?? null,
        seo: {
            title: payload?.title ?? null,
            description: null
        }
    } as MinimalContentDocument

    const contentDoc = minimalToContentDocument(minimal)
    contentDoc._id = contentDoc._id ?? payload?.id ?? pageIdFromPath(contentDoc.path)

    const timestamp = typeof payload?.timestamp === 'string'
        ? payload.timestamp
        : contentDoc.updatedAt ?? contentDoc.createdAt ?? new Date().toISOString()

    return {
        id: payload?.id ?? contentDoc._id,
        path: normalizePagePath(contentDoc.path ?? fallbackPath),
        title: payload?.title ?? contentDoc.title ?? null,
        timestamp,
        document: contentDoc
    }
}

export const useContentPagesStore = defineStore('content-pages', {
    state: (): PagesState => ({
        index: createEmptyFetchState<ContentPageSummary[]>([]),
        pages: {},
        history: {}
    }),

    getters: {
        getPage: (state) => (path: string): Maybe<ContentPageSummary> => {
            const normalizedPath = normalizePagePath(path)
            return state.pages[normalizedPath]?.data ?? null
        },
        getHistoryState: (state) => (path: string): FetchState<ContentPageHistoryEntry[]> | null => {
            const normalizedPath = normalizePagePath(path)
            return state.history[normalizedPath] ?? null
        }
    },

    actions: {
        async fetchIndex(force = false): Promise<ContentPageSummary[]> {
            if (!force && this.index.data.length && !this.index.pending) {
                return this.index.data
            }

            this.index.pending = true
            this.index.error = null

            const $f = useRequestFetch()

            try {
                const response: any = await $f('/api/content/pages')
                const pages = Array.isArray(response?.pages) ? response.pages : []
                const summaries = pages.map((entry: any) => extractSummary(entry))

                this.index.data = summaries
                return summaries
            } catch (error: any) {
                this.index.error = error?.message || 'Failed to load pages'
                throw error
            } finally {
                this.index.pending = false
            }
        },

        async fetchPage(path: string, force = false): Promise<Maybe<ContentPageSummary>> {
            const normalizedPath = normalizePagePath(path)
            const existing = this.pages[normalizedPath]

            if (!force && existing?.data && !existing.pending) {
                return existing.data
            }

            if (!this.pages[normalizedPath]) {
                this.pages[normalizedPath] = createEmptyFetchState<Maybe<ContentPageSummary>>(null)
            }

            const state = this.pages[normalizedPath]
            state.pending = true
            state.error = null

            const $f = useRequestFetch()

            try {
                const cacheBuster = Date.now().toString()
                const response: any = await $f('/api/content/pages', {
                    params: { path: normalizedPath, _ts: cacheBuster },
                    headers: {
                        'Cache-Control': 'no-cache',
                        Pragma: 'no-cache'
                    }
                })

                const summary = extractSummary(response?.page ?? response)
                state.data = summary
                return summary
            } catch (error: any) {
                state.error = error?.message || 'Failed to load page'
                state.data = null
                throw error
            } finally {
                state.pending = false
            }
        },

        async fetchHistory(path: string, force = false): Promise<ContentPageHistoryEntry[]> {
            const normalizedPath = normalizePagePath(path)

            if (!this.history[normalizedPath]) {
                this.history[normalizedPath] = createEmptyFetchState<ContentPageHistoryEntry[]>([])
            }

            const state = this.history[normalizedPath]

            if (!force && state.data.length && !state.pending) {
                return state.data
            }

            state.pending = true
            state.error = null

            const $f = useRequestFetch()

            try {
                const cacheBuster = Date.now().toString()
                const response: any = await $f('/api/content/pages/history', {
                    params: { path: normalizedPath, _ts: cacheBuster },
                    headers: {
                        'Cache-Control': 'no-cache',
                        Pragma: 'no-cache'
                    }
                })

                const history = Array.isArray(response?.history) ? response.history : []
                const entries = history.map((entry: any) => normalizeHistoryEntry(entry, normalizedPath))
                state.data = entries
                return entries
            } catch (error: any) {
                state.error = error?.message || 'Failed to load history'
                throw error
            } finally {
                state.pending = false
            }
        },

        async createPage(payload: {
            path: string
            title?: string | null
            meta?: Record<string, any>
            metadata?: Record<string, any>
            seoTitle?: string | null
            seoDescription?: string | null
        }): Promise<ContentPageSummary> {
            const normalizedPath = normalizePagePath(payload.path)
            const minimal = createDocumentFromTree(
                [],
                {
                    path: normalizedPath,
                    title: payload.title ?? 'Page title',
                    seoTitle: payload.seoTitle ?? payload.title ?? 'Page title',
                    seoDescription: payload.seoDescription ?? 'SEO description.',
                    navigation: true,
                    extension: 'md',
                    meta: payload.meta ?? payload.metadata ?? {}
                },
                { spacing: 'none' }
            )

            const document = minimalToContentDocument(minimal)
            return await this.saveDocument(document, { method: 'POST' })
        },

        async saveDocument(document: ContentPageDocument, options: { method?: 'POST' | 'PUT' } = {}): Promise<ContentPageSummary> {
            const method = options.method ?? 'PUT'
            const normalizedPath = normalizePagePath(document.path)
            const $f = useRequestFetch()

            const cleanDocument: ContentPageDocument = {
                ...document,
                layout: ensureLayout(document.layout),
                body: ensureMinimalBody(document.body),
                path: normalizedPath,
                seo: {
                    title: document.seo?.title ?? document.title ?? 'Page title',
                    description: document.seo?.description ?? 'SEO description.'
                },
                stem: document.stem ?? deriveStem(normalizedPath),
                meta: document.meta ? clonePlain(document.meta) : {},
                navigation: typeof document.navigation === 'boolean' ? document.navigation : true
            }

            const response: any = await $f('/api/content/pages', {
                method,
                body: {
                    document: cleanDocument
                }
            })

            const summary = extractSummary(response?.page ?? response)
            this.pages[normalizedPath] = createEmptyFetchState(summary)

            const existingIndex = this.index.data.filter((entry) => entry.id !== summary.id)
            existingIndex.push(summary)
            this.index.data = existingIndex.sort((a, b) => a.path.localeCompare(b.path))

            try {
                await this.fetchHistory(normalizedPath, true)
            } catch (error) {
                console.error('Failed to refresh history after save:', error)
            }

            return summary
        },

        async deletePage(path: string): Promise<void> {
            const normalizedPath = normalizePagePath(path)
            const $f = useRequestFetch()

            await $f('/api/content/pages', {
                method: 'DELETE',
                params: { path: normalizedPath }
            })

            delete this.pages[normalizedPath]
            delete this.history[normalizedPath]
            this.index.data = this.index.data
                .filter((entry) => normalizePagePath(entry.path) !== normalizedPath)
        }
    }
})
