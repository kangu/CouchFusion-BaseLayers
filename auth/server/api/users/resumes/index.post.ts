import {defineEventHandler, createError, getHeader, readMultipartFormData} from 'h3'
import {getSession, getDocument, putDocument, putAttachment} from '#database/utils/couchdb'
import useIds from '../../../../app/composables/useIds'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME_TYPES = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
])

const extractAuthSessionCookie = (cookieHeader: string | undefined): string | null => {
    if (!cookieHeader) {
        return null
    }

    for (const part of cookieHeader.split(';')) {
        const trimmed = part.trim()
        if (trimmed.startsWith('AuthSession=')) {
            return trimmed.substring('AuthSession='.length)
        }
    }

    return null
}

export default defineEventHandler(async (event) => {
    const cookieHeader = getHeader(event, 'cookie')
    const sessionCookie = extractAuthSessionCookie(cookieHeader)

    if (!sessionCookie) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Authentication required'
        })
    }

    const session = await getSession({authSessionCookie: sessionCookie})

    if (!session?.userCtx?.name) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Invalid session'
        })
    }

    const formData = await readMultipartFormData(event)

    if (!formData || formData.length === 0) {
        throw createError({
            statusCode: 400,
            statusMessage: 'No file provided'
        })
    }

    const file = formData.find(field => field.filename)

    if (!file || !file.filename || !file.type || !file.data) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Invalid file upload payload'
        })
    }

    if (file.data.length > MAX_FILE_SIZE) {
        throw createError({
            statusCode: 413,
            statusMessage: 'File exceeds maximum size of 10MB'
        })
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Unsupported file type. Allowed: PDF, DOC, DOCX'
        })
    }

    const userId = session.userCtx.name
    const documentId = `org.couchdb.user:${userId}`
    const userDocument = await getDocument<Record<string, any>>('_users', documentId)

    if (!userDocument || !userDocument._rev) {
        throw createError({
            statusCode: 404,
            statusMessage: 'User document not found'
        })
    }

    const {randomId} = useIds()
    const safeBaseName = file.filename.replace(/[^a-zA-Z0-9-_\.]/g, '_')
    const attachmentName = `${Date.now()}-${randomId(6)}-${safeBaseName}`

    const uploadResponse = await putAttachment(
        '_users',
        documentId,
        attachmentName,
        file.data,
        file.type,
        userDocument._rev
    )
    console.log('Upload response', uploadResponse)

    const refreshedDocument = await getDocument<Record<string, any>>('_users', documentId)
    console.log('Refreshed document', documentId, refreshedDocument)

    if (!refreshedDocument || !refreshedDocument._rev) {
        throw createError({
            statusCode: 500,
            statusMessage: 'Failed to refresh user document after upload'
        })
    }

    const metadata = typeof refreshedDocument.resumes === 'object' && refreshedDocument.resumes !== null
        ? {...refreshedDocument.resumes}
        : {}

    metadata[attachmentName] = {
        originalName: file.filename,
        uploadedAt: new Date().toISOString(),
        contentType: file.type,
        size: file.data.length
    }

    if (Object.keys(metadata).length === 0) {
        delete refreshedDocument.resumes
    } else {
        refreshedDocument.resumes = metadata
    }

    const updateResponse = await putDocument('_users', {
        ...refreshedDocument,
        _rev: refreshedDocument._rev
    })

    return {
        success: true,
        attachment: {
            name: attachmentName,
            originalName: file.filename,
            contentType: file.type,
            size: file.data.length,
            uploadedAt: metadata[attachmentName].uploadedAt
        },
        rev: updateResponse.rev
    }
})
