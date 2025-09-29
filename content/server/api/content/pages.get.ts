import { defineEventHandler, getQuery, createError } from 'h3'
import { getView } from '#database/utils/couchdb'
import { getContentDatabaseName } from '../../utils/database'
import { normalizePagePath, pageIdFromPath } from '#content/utils/page'

export default defineEventHandler(async (event) => {
    try {
        const query = getQuery(event)
        const requestedPath = typeof query.path === 'string' ? query.path : null

        const databaseName = getContentDatabaseName()

        if (requestedPath) {
            const normalizedPath = normalizePagePath(requestedPath)
            const viewResult = await getView(databaseName, 'content', 'by_path', {
                key: normalizedPath,
                include_docs: true,
                limit: 1
            })

            const row = viewResult?.rows?.[0]

            if (!row || !row.doc) {
                throw createError({
                    statusCode: 404,
                    statusMessage: 'Page not found'
                })
            }

            const doc: Record<string, any> = row.doc
            const seoTitle = doc.seoTitle ?? doc.seo?.title ?? null
            const seoDescription = doc.seoDescription ?? doc.seo?.description ?? null
            const meta = doc.meta ?? doc.metadata ?? {}

            return {
                success: true,
                page: {
                    id: doc._id || pageIdFromPath(normalizedPath),
                    path: normalizedPath,
                    title: doc.title ?? row.value?.title ?? null,
                    seoTitle,
                    seoDescription,
                    meta,
                    updatedAt: doc.updatedAt ?? doc.updated_at ?? row.value?.updatedAt ?? null,
                    doc
                }
            }
        }

        const viewResult = await getView(databaseName, 'content', 'by_path', {
            include_docs: true
        })

        const pages = (viewResult?.rows || []).map((row) => {
            const doc: Record<string, any> | undefined = row.doc ?? undefined
            const path = typeof row.key === 'string' ? row.key : (doc?._id ? doc._id.replace(/^page-/, '') : null)
            const normalizedPath = path ? normalizePagePath(path) : '/'
            const seoTitle = doc?.seoTitle ?? doc?.seo?.title ?? null
            const seoDescription = doc?.seoDescription ?? doc?.seo?.description ?? null
            const meta = doc?.meta ?? doc?.metadata ?? {}

            return {
                id: doc?._id ?? row.value?.id ?? pageIdFromPath(normalizedPath),
                path: normalizedPath,
                title: doc?.title ?? row.value?.title ?? null,
                seoTitle,
                seoDescription,
                meta,
                updatedAt: doc?.updatedAt ?? doc?.updated_at ?? row.value?.updatedAt ?? null,
                doc
            }
        })

        return {
            success: true,
            pages
        }
    } catch (error: any) {
        if (error?.statusCode) {
            throw error
        }

        console.error('Content pages GET error:', error)

        throw createError({
            statusCode: 500,
            statusMessage: 'Failed to fetch pages'
        })
    }
})
