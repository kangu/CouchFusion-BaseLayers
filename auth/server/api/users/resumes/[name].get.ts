import { defineEventHandler, createError, getHeader, getQuery, getRouterParam, sendStream } from 'h3'
import { getSession, getDocument, getAttachment } from '#database/utils/couchdb'
import { Readable } from 'node:stream'

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

  if (!userDocument || !userDocument._attachments) {
    throw createError({
      statusCode: 404,
      statusMessage: 'User document or attachments not found'
    })
  }

  const attachmentMeta = userDocument._attachments[attachmentName]

  if (!attachmentMeta) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Attachment not found'
    })
  }

  const data = await getAttachment('_users', documentId, attachmentName)

  if (!data) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Attachment data unavailable'
    })
  }

  const query = getQuery(event)
  const asDownload = query.download === '1'

  const stream = Readable.from(data)

  event.node.res.setHeader('Content-Type', attachmentMeta.content_type || 'application/octet-stream')
  event.node.res.setHeader('Content-Length', String(attachmentMeta.length || data.length))

  const originalName = typeof userDocument.resumes === 'object' && userDocument.resumes !== null
    ? userDocument.resumes[attachmentName]?.originalName || attachmentName
    : attachmentName

  event.node.res.setHeader('Content-Disposition', `${asDownload ? 'attachment' : 'inline'}; filename="${encodeURIComponent(originalName)}"`)

  return sendStream(event, stream)
})
