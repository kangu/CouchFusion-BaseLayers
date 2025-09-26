import { defineEventHandler, readBody, createError } from 'h3'
import { getDocument, putDocument } from '#database/utils/couchdb'
import { getContentDatabaseName } from '../../utils/database'
import { normalizePagePath, pageIdFromPath } from '#content/utils/page'
import { requireAdminSession } from '../../utils/auth'

interface UpdatePagePayload {
    path: string
    title?: string | null
    content?: any
    metadata?: Record<string, any> | null
}

export default defineEventHandler(async (event) => {
    await requireAdminSession(event)

    try {
        const body = await readBody<UpdatePagePayload>(event)

        if (!body || typeof body.path !== 'string') {
            throw createError({
                statusCode: 400,
                statusMessage: 'Invalid payload: path is required'
            })
        }

        const normalizedPath = normalizePagePath(body.path)
        const documentId = pageIdFromPath(normalizedPath)
        const databaseName = getContentDatabaseName()

        const existingDocument = await getDocument<Record<string, any>>(databaseName, documentId)

        if (!existingDocument) {
            throw createError({
                statusCode: 404,
                statusMessage: 'Page not found'
            })
        }

        const updatedDocument = {
            ...existingDocument,
            title: body.title !== undefined ? body.title : existingDocument.title ?? null,
            content: body.content !== undefined ? body.content : existingDocument.content ?? null,
            metadata: body.metadata !== undefined ? body.metadata : existingDocument.metadata ?? {},
            updatedAt: new Date().toISOString()
        }

        const response = await putDocument(databaseName, updatedDocument)

        return {
            success: true,
            id: response.id,
            rev: response.rev,
            page: updatedDocument
        }
    } catch (error: any) {
        if (error?.statusCode) {
            throw error
        }

        console.error('Content pages PUT error:', error)

        throw createError({
            statusCode: 500,
            statusMessage: 'Failed to update page'
        })
    }
})
