import { defineStore } from 'pinia'
import { normalizePagePath, pageIdFromPath } from '#content/utils/page'

type Maybe<T> = T | null | undefined

type ContentPayload = { [key: string]: any }

export interface ContentPageDocument extends ContentPayload {
    _id: string
    path: string
    title?: string | null
    content?: any
    seoTitle?: string | null
    seoDescription?: string | null
    seo?: {
        title?: string | null
        description?: string | null
    } | null
    meta?: Record<string, any> | null
    metadata?: Record<string, any> | null
    createdAt?: string | null
    updatedAt?: string | null
}

export interface ContentPageSummary {
    id: string
    path: string
    title: string | null
    seoTitle: string | null
    seoDescription: string | null
    meta: Record<string, any>
    updatedAt: string | null
    doc: ContentPageDocument | null
}

interface FetchState<T> {
    pending: boolean
    error: string | null
    data: T
}

interface PagesState {
    index: FetchState<ContentPageSummary[]>
    pages: Record<string, FetchState<Maybe<ContentPageSummary>>>
}

function createEmptyFetchState<T>(initialValue: T): FetchState<T> {
    return {
        pending: false,
        error: null,
        data: initialValue
    }
}

function extractSummary(payload: any): ContentPageSummary {
    const doc: ContentPageDocument | null = payload?.doc ?? payload?.page ?? payload ?? null
    const path = payload?.path ?? doc?.path ?? '/'
    const normalizedPath = normalizePagePath(path)
    const seoTitle = payload?.seoTitle ?? doc?.seoTitle ?? doc?.seo?.title ?? null
    const seoDescription = payload?.seoDescription ?? doc?.seoDescription ?? doc?.seo?.description ?? null
    const meta =
        payload?.meta ??
        doc?.meta ??
        doc?.metadata ??
        {}

    return {
        id: payload?.id ?? doc?._id ?? pageIdFromPath(normalizedPath),
        path: normalizedPath,
        title: payload?.title ?? doc?.title ?? null,
        seoTitle,
        seoDescription,
        meta,
        updatedAt: payload?.updatedAt ?? doc?.updatedAt ?? doc?.updated_at ?? null,
        doc
    }
}

export const useContentPagesStore = defineStore('content-pages', {
    state: (): PagesState => ({
        index: createEmptyFetchState<ContentPageSummary[]>([]),
        pages: {}
    }),

    getters: {
        getPage: (state) => (path: string): Maybe<ContentPageSummary> => {
            const normalizedPath = normalizePagePath(path)
            return state.pages[normalizedPath]?.data ?? null
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
                const response: any = await $f('/api/content/pages', {
                    params: { path: normalizedPath }
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

        async createPage(payload: {
            path: string
            title?: string | null
            content?: any
            metadata?: Record<string, any>
            meta?: Record<string, any>
            seoTitle?: string | null
            seoDescription?: string | null
        }): Promise<ContentPageSummary> {
            const normalizedPath = normalizePagePath(payload.path)
            const $f = useRequestFetch()

            const response: any = await $f('/api/content/pages', {
                method: 'POST',
                body: {
                    path: normalizedPath,
                    title: payload.title ?? null,
                    content: payload.content ?? null,
                    metadata: payload.metadata ?? payload.meta ?? {},
                    meta: payload.meta ?? payload.metadata ?? {},
                    seoTitle: payload.seoTitle ?? null,
                    seoDescription: payload.seoDescription ?? null
                }
            })

            const summary = extractSummary(response?.page ?? response)

            this.pages[normalizedPath] = createEmptyFetchState(summary)
            const filtered = this.index.data.filter((entry) => entry.path !== normalizedPath)
            filtered.push(summary)
            this.index.data = filtered

            return summary
        },

        async updatePage(payload: {
            path: string
            title?: string | null
            content?: any
            metadata?: Record<string, any> | null
            meta?: Record<string, any> | null
            seoTitle?: string | null
            seoDescription?: string | null
        }): Promise<ContentPageSummary> {
            const normalizedPath = normalizePagePath(payload.path)
            const $f = useRequestFetch()

            const response: any = await $f('/api/content/pages', {
                method: 'PUT',
                body: {
                    path: normalizedPath,
                    title: payload.title,
                    content: payload.content,
                    metadata: payload.metadata,
                    meta: payload.meta,
                    seoTitle: payload.seoTitle,
                    seoDescription: payload.seoDescription
                }
            })

            const summary = extractSummary(response?.page ?? response)

            this.pages[normalizedPath] = createEmptyFetchState(summary)
            this.index.data = this.index.data.map((entry) => (entry.path === normalizedPath ? summary : entry))

            return summary
        }
    }
})
