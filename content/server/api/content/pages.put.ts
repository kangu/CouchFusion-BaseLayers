import { defineEventHandler, readBody, createError } from 'h3'
import { getDocument, putDocument } from '#database/utils/couchdb'
import { getContentDatabaseName } from '../../utils/database'
import { requireAdminSession } from '../../utils/auth'
import { sanitiseIncomingDocument, contentIdFromPath } from '../../utils/content-documents'
import { normalizePagePath } from '#content/utils/page'

export default defineEventHandler(async (event) => {
    await requireAdminSession(event)

    try {
        const body = await readBody<{ document: any }>(event)

        if (!body || typeof body.document !== 'object' || body.document === null) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Invalid payload: document is required'
            })
        }

        const provisional = sanitiseIncomingDocument(body.document, { isCreate: true })
        const normalizedPath = normalizePagePath(provisional.path)
        const documentId = provisional._id ?? contentIdFromPath(normalizedPath)
        const databaseName = getContentDatabaseName()

        const existingDocument = await getDocument<Record<string, any>>(databaseName, documentId)

        if (!existingDocument) {
            throw createError({
                statusCode: 404,
                statusMessage: 'Page not found'
            })
        }

        const updatedDocument = sanitiseIncomingDocument(body.document, {
            isCreate: false,
            existing: existingDocument
        })

        updatedDocument._rev = existingDocument._rev

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
