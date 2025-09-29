import { defineEventHandler, readBody, createError } from 'h3'
import { getDocument, putDocument } from '#database/utils/couchdb'
import { getContentDatabaseName } from '../../utils/database'
import { requireAdminSession } from '../../utils/auth'
import { sanitiseIncomingDocument } from '../../utils/content-documents'

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

        const document = sanitiseIncomingDocument(body.document, { isCreate: true })
        const databaseName = getContentDatabaseName()

        const existingDocument = await getDocument(databaseName, document._id)
        if (existingDocument) {
            throw createError({
                statusCode: 409,
                statusMessage: 'Page already exists'
            })
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
