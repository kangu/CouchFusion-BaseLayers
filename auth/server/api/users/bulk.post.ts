import { defineEventHandler, readBody, createError, getHeader } from 'h3'
import { bulkDocs, getSession } from '#database/utils/couchdb'

interface BulkUserDocument extends Record<string, unknown> {
  _id: string
}

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
      statusCode: 404,
      statusMessage: 'Not found'
    })
  }

  const session = await getSession({ authSessionCookie: sessionCookie })

  if (!session?.userCtx?.roles?.includes('admin')) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not found'
    })
  }

  const payload = await readBody<BulkUserDocument[] | null>(event)

  if (!Array.isArray(payload) || payload.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Payload must be a non-empty array of user documents'
    })
  }

  const documents: BulkUserDocument[] = []

  payload.forEach((document, index) => {
    if (!document || typeof document !== 'object') {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid document at index ${index}`
      })
    }

    const id = typeof document._id === 'string' ? document._id.trim() : ''

    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: `Document at index ${index} is missing a valid _id`
      })
    }
    documents.push({ ...document, _id: id })
  })

  try {
    const results = await bulkDocs('_users', documents)

    return {
      success: true,
      processed: results.length,
      results
    }
  } catch (error: any) {
    throw createError({
      statusCode: error?.statusCode || 500,
      statusMessage: error?.statusMessage || error?.message || 'Bulk user save failed'
    })
  }
})
