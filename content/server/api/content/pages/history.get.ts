import { defineEventHandler, getQuery, createError, setResponseHeader } from 'h3'
import { requireAdminSession } from '../../../utils/auth'
import { fetchPageHistory } from '../../../utils/page-history'
import { normalizePagePath } from '#content/utils/page'
import { contentToMinimalDocument } from '#content/utils/page-documents'

export default defineEventHandler(async (event) => {
    await requireAdminSession(event)
    setResponseHeader(event, 'Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    setResponseHeader(event, 'Pragma', 'no-cache')
    setResponseHeader(event, 'Expires', '0')

    const query = getQuery(event)
    const requestedPath = typeof query.path === 'string' ? query.path : null
    const limitParam = typeof query.limit === 'string' ? Number.parseInt(query.limit, 10) : null

    if (!requestedPath) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Query parameter "path" is required'
        })
    }

    const normalizedPath = normalizePagePath(requestedPath)
    const limit = Number.isFinite(limitParam) && limitParam! > 0 ? Math.min(limitParam!, 10) : undefined

    const history = await fetchPageHistory(normalizedPath, limit)

    return {
        success: true,
        history: history.map((entry) => ({
            id: entry.id,
            path: entry.path,
            timestamp: entry.timestamp,
            title: entry.title,
            document: contentToMinimalDocument(entry.document)
        }))
    }
})
