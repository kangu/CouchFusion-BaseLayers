import { defineEventHandler, readBody, createError } from 'h3'
import { getDocument, putDocument } from '#database/utils/couchdb'
import { getContentDatabaseName } from '../../utils/database'
import { normalizePagePath, pageIdFromPath } from '#content/utils/page'
import { requireAdminSession } from '../../utils/auth'

interface CreatePagePayload {
    path: string
    title?: string | null
    content?: any
    metadata?: Record<string, any>
    meta?: Record<string, any>
    seoTitle?: string | null
    seoDescription?: string | null
}

export default defineEventHandler(async (event) => {
    await requireAdminSession(event)

    try {
        const body = await readBody<CreatePagePayload>(event)

        if (!body || typeof body.path !== 'string') {
            throw createError({
                statusCode: 400,
                statusMessage: 'Invalid payload: path is required'
            })
        }

        const normalizedPath = normalizePagePath(body.path)
        const documentId = pageIdFromPath(normalizedPath)
        const databaseName = getContentDatabaseName()

        const existingDocument = await getDocument(databaseName, documentId)
        if (existingDocument) {
            throw createError({
                statusCode: 409,
                statusMessage: 'Page already exists'
            })
        }

        const timestamp = new Date().toISOString()

        const meta = body.meta ?? body.metadata ?? {}
        const seoTitle = body.seoTitle ?? null
        const seoDescription = body.seoDescription ?? null

        const document = {
            _id: documentId,
            type: 'page',
            path: normalizedPath,
            title: body.title ?? null,
            content: body.content ?? null,
            seo: {
                title: seoTitle,
                description: seoDescription
            },
            seoTitle,
            seoDescription,
            meta,
            metadata: meta,
            createdAt: timestamp,
            updatedAt: timestamp
        }

        const response = await putDocument(databaseName, document)

        return {
            success: true,
            id: response.id,
            rev: response.rev,
            page: document
        }
    } catch (error: any) {
        if (error?.statusCode) {
            throw error
        }

        console.error('Content pages POST error:', error)

        throw createError({
            statusCode: 500,
            statusMessage: 'Failed to create page'
        })
    }
})
