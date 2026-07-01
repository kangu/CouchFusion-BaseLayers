import { defineStore } from 'pinia'
import { normalizePagePath, pageIdFromPath } from '#content/utils/page'
import { createDocumentFromTree } from '#content/app/utils/contentBuilder'
import type { MinimalContentDocument } from '#content/app/utils/contentBuilder'
import type { ContentPageDocument, ContentPageSummary, ContentPageHistoryEntry } from '#content/types/content-page'
import { createError, useRuntimeConfig } from '#imports'
import {
    ensureMinimalBody,
    ensureLayout,
    deriveStem,
    clonePlain,
    minimalToContentDocument,
    normalizeSeoImage
} from '#content/utils/page-documents'
import {
    buildLocalizedPath,
    normalizeLocaleCode,
    resolveContentI18nConfig,
    resolveContentLocalePath
} from '#content/utils/i18n'

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

interface ResolvedStoreTarget {
    basePath: string
    locale: string
    storeKey: string
}

const resolveStoreTarget = (
    path: string,
    localeOverride?: string | null,
): ResolvedStoreTarget => {
    const normalizedPath = normalizePagePath(path)

    try {
        const runtimeConfig = useRuntimeConfig()
        const i18nConfig = resolveContentI18nConfig(
            runtimeConfig.content?.i18n ?? runtimeConfig.public?.content?.i18n
        )

        const fromPath = resolveContentLocalePath(normalizedPath, i18nConfig)
        const normalizedOverride = normalizeLocaleCode(localeOverride ?? null)
        const locale =
            normalizedOverride && i18nConfig.locales.includes(normalizedOverride)
                ? normalizedOverride
                : fromPath.locale

        return {
            basePath: fromPath.basePath,
            locale,
            storeKey: buildLocalizedPath(fromPath.basePath, locale, i18nConfig)
        }
    } catch {
        return {
            basePath: normalizedPath,
            locale: 'en',
            storeKey: normalizedPath
        }
    }
}

const normalizeDocument = (
    payload: ContentPayload | null | undefined,
    fallback: { id: string; path: string; title: string | null; seoTitle: string | null; seoDescription: string | null }
): ContentPageDocument => {
    const raw = (payload && typeof payload === 'object') ? payload : {}
    const normalizedPath = normalizePagePath(raw.path ?? fallback.path)
    const seoTitle = raw.seo?.title ?? fallback.seoTitle ?? fallback.title ?? 'Page title'
    const seoDescription = raw.seo?.description ?? fallback.seoDescription ?? 'SEO description.'
    const seoImage = normalizeSeoImage(raw.seo?.image)

    return {
        _id: raw._id ?? fallback.id,
        _rev: raw._rev,
        title: raw.title ?? fallback.title ?? 'Page title',
        layout: ensureLayout(raw.layout),
        body: ensureMinimalBody(raw.body),
        path: normalizedPath,
        seo: {
            title: seoTitle,
            description: seoDescription,
            image: seoImage
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
    const fallbackSeoImage = normalizeSeoImage(payload?.seoImage ?? rawDoc?.seo?.image)

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
    const localization =
        payload?.localization && typeof payload.localization === 'object'
            ? payload.localization
            : null

    return {
        id: document._id,
        path: document.path,
        title: document.title ?? null,
        seoTitle: document.seo.title,
        seoDescription: document.seo.description,
        seoImage: document.seo.image ?? fallbackSeoImage ?? null,
        meta,
        updatedAt,
        document,
        localization
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
        locale: payload?.locale ?? null,
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
        getPage: (state) => (path: string, locale?: string | null): Maybe<ContentPageSummary> => {
            const target = resolveStoreTarget(path, locale)
            return state.pages[target.storeKey]?.data ?? null
        },
        getHistoryState: (state) => (path: string, locale?: string | null): FetchState<ContentPageHistoryEntry[]> | null => {
            const target = resolveStoreTarget(path, locale)
            return state.history[target.storeKey] ?? null
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

        async fetchPage(
            path: string,
            force = false,
            options: { locale?: string | null } = {},
        ): Promise<Maybe<ContentPageSummary>> {
            const target = resolveStoreTarget(path, options.locale)
            const existing = this.pages[target.storeKey]

            if (!force && existing?.data && !existing.pending) {
                return existing.data
            }

            if (!this.pages[target.storeKey]) {
                this.pages[target.storeKey] = createEmptyFetchState<Maybe<ContentPageSummary>>(null)
            }

            const state = this.pages[target.storeKey]
            state.pending = true
            state.error = null

            const $f = useRequestFetch()

            try {
                const cacheBuster = Date.now().toString()
                const response: any = await $f('/api/content/pages', {
                    params: {
                        path: target.basePath,
                        locale: target.locale,
                        _ts: cacheBuster
                    },
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

        async fetchPageOrThrow(
            path: string,
            force = false,
            options: { locale?: string | null } = {},
        ): Promise<ContentPageSummary> {
            const summary = await this.fetchPage(path, force, options)

            if (!summary) {
                throw createError({
                    statusCode: 404,
                    statusMessage: 'Page not found'
                })
            }

            return summary
        },

        async fetchHistory(
            path: string,
            force = false,
            options: { locale?: string | null } = {},
        ): Promise<ContentPageHistoryEntry[]> {
            const target = resolveStoreTarget(path, options.locale)

            if (!this.history[target.storeKey]) {
                this.history[target.storeKey] = createEmptyFetchState<ContentPageHistoryEntry[]>([])
            }

            const state = this.history[target.storeKey]

            if (!force && state.data.length && !state.pending) {
                return state.data
            }

            state.pending = true
            state.error = null

            const $f = useRequestFetch()

            try {
                const cacheBuster = Date.now().toString()
                const response: any = await $f('/api/content/pages/history', {
                    params: {
                        path: target.basePath,
                        locale: target.locale,
                        _ts: cacheBuster
                    },
                    headers: {
                        'Cache-Control': 'no-cache',
                        Pragma: 'no-cache'
                    }
                })

                const history = Array.isArray(response?.history) ? response.history : []
                const entries = history.map((entry: any) => normalizeHistoryEntry(entry, target.basePath))
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
            seoImage?: string | null
        }, options: { locale?: string | null } = {}): Promise<ContentPageSummary> {
            const normalizedPath = normalizePagePath(payload.path)
            const minimal = createDocumentFromTree(
                [],
                {
                    path: normalizedPath,
                    title: payload.title ?? 'Page title',
                    seoTitle: payload.seoTitle ?? payload.title ?? 'Page title',
                    seoDescription: payload.seoDescription ?? 'SEO description.',
                    seoImage: normalizeSeoImage(payload.seoImage),
                    navigation: true,
                    extension: 'md',
                    meta: payload.meta ?? payload.metadata ?? {}
                },
                { spacing: 'none' }
            )

            const document = minimalToContentDocument(minimal)
            return await this.saveDocument(document, {
                method: 'POST',
                locale: options.locale
            })
        },

        async saveDocument(
            document: ContentPageDocument,
            options: { method?: 'POST' | 'PUT'; locale?: string | null } = {},
        ): Promise<ContentPageSummary> {
            const method = options.method ?? 'PUT'
            const normalizedPath = normalizePagePath(document.path)
            const target = resolveStoreTarget(normalizedPath, options.locale)
            const $f = useRequestFetch()

            const cleanDocument: ContentPageDocument = {
                ...document,
                layout: ensureLayout(document.layout),
                body: ensureMinimalBody(document.body),
                path: normalizedPath,
                seo: {
                    title: document.seo?.title ?? document.title ?? 'Page title',
                    description: document.seo?.description ?? 'SEO description.',
                    image: normalizeSeoImage(document.seo?.image)
                },
                stem: document.stem ?? deriveStem(normalizedPath),
                meta: document.meta ? clonePlain(document.meta) : {},
                navigation: typeof document.navigation === 'boolean' ? document.navigation : true
            }

            const response: any = await $f('/api/content/pages', {
                method,
                body: {
                    document: cleanDocument,
                    locale: target.locale
                }
            })

            const summary = extractSummary(response?.page ?? response)
            this.pages[target.storeKey] = createEmptyFetchState(summary)

            const existingIndex = this.index.data.filter((entry) => entry.id !== summary.id)
            existingIndex.push(summary)
            this.index.data = existingIndex.sort((a, b) => a.path.localeCompare(b.path))

            try {
                await this.fetchHistory(target.basePath, true, { locale: target.locale })
            } catch (error) {
                console.error('Failed to refresh history after save:', error)
            }

            return summary
        },

        applyLiveDocument(
            document: MinimalContentDocument,
            options: { locale?: string | null } = {},
        ): ContentPageSummary {
            const contentDocument = minimalToContentDocument(document)
            const target = resolveStoreTarget(contentDocument.path, options.locale)
            const summary = extractSummary({ document: contentDocument })

            if (!this.pages[target.storeKey]) {
                this.pages[target.storeKey] = createEmptyFetchState<Maybe<ContentPageSummary>>(null)
            }

            const state = this.pages[target.storeKey]
            state.pending = false
            state.error = null
            state.data = summary

            const filteredIndex = this.index.data.filter(
                (entry) => normalizePagePath(entry.path) !== target.basePath
            )
            filteredIndex.push(summary)
            this.index.data = filteredIndex.sort((a, b) => a.path.localeCompare(b.path))

            return summary
        },

        async deletePage(path: string, options: { locale?: string | null } = {}): Promise<void> {
            const target = resolveStoreTarget(path, options.locale)
            const runtimeConfig = useRuntimeConfig()
            const i18nConfig = resolveContentI18nConfig(
                runtimeConfig.content?.i18n ?? runtimeConfig.public?.content?.i18n
            )
            const $f = useRequestFetch()

            await $f('/api/content/pages', {
                method: 'DELETE',
                params: {
                    path: target.basePath,
                    locale: target.locale
                }
            })

            const aliases = i18nConfig.locales.map((locale) =>
                buildLocalizedPath(target.basePath, locale, i18nConfig)
            )
            for (const key of aliases) {
                delete this.pages[key]
                delete this.history[key]
            }
            this.index.data = this.index.data
                .filter((entry) => normalizePagePath(entry.path) !== target.basePath)
        }
    }
})
