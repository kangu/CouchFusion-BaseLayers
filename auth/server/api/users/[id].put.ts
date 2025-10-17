import { defineEventHandler, readBody, createError } from 'h3'
import { getDocument, putDocument } from '#database/utils/couchdb'

const POW_LAB_ALLOWED_STATUSES = new Set(['pending', 'pending_payment', 'active', 'expired'])

interface UpdateUserPayload {
  email?: string | null
  roles?: string[] | null
  profile?: Record<string, unknown> | null
  pow_lab_status?: string | null
  pow_lab_valid_until?: string | null
  pow_lab_lite_status?: string | null
  pow_lab_lite_valid_until?: string | null
  allow_affiliate?: boolean | null
}

type CouchUserDocument = Record<string, unknown> & {
  _id: string
  _rev?: string
  name?: string
  roles?: string[]
  email?: string
  profile?: Record<string, unknown>
}

/**
 * Update selected user document in CouchDB _users database.
 */
export default defineEventHandler(async (event) => {
  const params = event.context.params || {}
  const encodedId = params.id

  if (!encodedId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'User document id is required'
    })
  }

  const documentId = decodeURIComponent(encodedId)
  const payload = await readBody<UpdateUserPayload | null>(event)

  if (!payload || typeof payload !== 'object') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid payload for user update'
    })
  }

  const existingDocument = await getDocument<CouchUserDocument>('_users', documentId)

  if (!existingDocument) {
    throw createError({
      statusCode: 404,
      statusMessage: 'User document not found'
    })
  }

  const nextDocument: CouchUserDocument = { ...existingDocument }

  if (Object.prototype.hasOwnProperty.call(payload, 'email')) {
    const email = payload.email === null ? undefined : payload.email
    if (email !== undefined && typeof email !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Email must be a string or null'
      })
    }
    if (email === undefined) {
      delete nextDocument.email
    } else {
      nextDocument.email = email
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'profile')) {
    const profile = payload.profile === null ? undefined : payload.profile
    if (profile !== undefined && typeof profile !== 'object') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Profile must be an object or null'
      })
    }
    if (profile === undefined) {
      delete nextDocument.profile
    } else {
      nextDocument.profile = profile
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'roles')) {
    const { roles } = payload
    if (roles === null) {
      nextDocument.roles = []
    } else if (!Array.isArray(roles) || roles.some(role => typeof role !== 'string')) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Roles must be an array of strings'
      })
    } else {
      nextDocument.roles = roles
    }
  }

  const statusFields: Array<keyof UpdateUserPayload> = [
    'pow_lab_status',
    'pow_lab_lite_status'
  ]

  for (const field of statusFields) {
    if (!Object.prototype.hasOwnProperty.call(payload, field)) {
      continue
    }

    const value = payload[field]
    if (value === null) {
      delete nextDocument[field]
      continue
    }

    if (typeof value !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: `${String(field)} must be a string or null`
      })
    }

    if (!POW_LAB_ALLOWED_STATUSES.has(value)) {
      throw createError({
        statusCode: 400,
        statusMessage: `${String(field)} must be one of: ${Array.from(POW_LAB_ALLOWED_STATUSES).join(', ')}`
      })
    }

    nextDocument[field] = value
  }

  const dateFields: Array<keyof UpdateUserPayload> = [
    'pow_lab_valid_until',
    'pow_lab_lite_valid_until'
  ]

  for (const field of dateFields) {
    if (!Object.prototype.hasOwnProperty.call(payload, field)) {
      continue
    }

    const value = payload[field]
    if (value === null) {
      delete nextDocument[field]
      continue
    }

    if (typeof value !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: `${String(field)} must be a string or null`
      })
    }

    nextDocument[field] = value
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'allow_affiliate')) {
    const value = payload.allow_affiliate

    if (value === null) {
      delete nextDocument.allow_affiliate
    } else if (typeof value === 'boolean') {
      nextDocument.allow_affiliate = value
    } else {
      throw createError({
        statusCode: 400,
        statusMessage: 'allow_affiliate must be a boolean or null'
      })
    }
  }

  const response = await putDocument('_users', nextDocument)

  return {
    success: true,
    id: documentId,
    rev: response.rev
  }
})
