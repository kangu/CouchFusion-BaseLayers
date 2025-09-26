import { defineEventHandler, createError, getHeader, getRouterParam } from 'h3'
import { getSession, getDocument, deleteAttachment, putDocument } from '#database/utils/couchdb'

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

  const session = await getSession({ authSessionCookie: sessionCookie })

  if (!session?.userCtx?.name) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid session'
    })
  }

  const attachmentName = getRouterParam(event, 'name')

  if (!attachmentName) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Attachment name is required'
    })
  }

  const documentId = `org.couchdb.user:${session.userCtx.name}`
  const userDocument = await getDocument<Record<string, any>>('_users', documentId)

  if (!userDocument || !userDocument._rev) {
    throw createError({
      statusCode: 404,
      statusMessage: 'User document not found'
    })
  }

  if (!userDocument._attachments || !userDocument._attachments[attachmentName]) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Attachment not found'
    })
  }

  const deletionResponse = await deleteAttachment(
    '_users',
    documentId,
    attachmentName,
    userDocument._rev
  )

  const refreshedDocument = await getDocument<Record<string, any>>('_users', documentId)

  if (!refreshedDocument || !refreshedDocument._rev) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to refresh user document after deletion'
    })
  }

  const metadata = typeof refreshedDocument.resumes === 'object' && refreshedDocument.resumes !== null
    ? { ...refreshedDocument.resumes }
    : {}

  if (metadata[attachmentName]) {
    delete metadata[attachmentName]
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
    rev: updateResponse.rev
  }
})
