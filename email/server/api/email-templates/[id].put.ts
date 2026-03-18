import { defineEventHandler, readBody, createError } from 'h3'
import { putDocument, getDocument } from '#database/utils/couchdb'
import { assertAdminSession } from '#auth/server/utils/assert-admin-session'
import {
  EMAIL_DATABASE_NAME,
  getEmailTemplatePrefix,
  extractTemplatePlaceholders
} from '../../utils/email-templates'

/**
 * Strip prefix from template ID for client display
 */
const stripPrefix = (id: string, prefix: string): string => {
  if (id.startsWith(prefix)) {
    return id.slice(prefix.length)
  }
  return id
}

export default defineEventHandler(async (event) => {
  await assertAdminSession(event)

  const runtimeConfig = useRuntimeConfig()
  const dbLoginPrefix = runtimeConfig.dbLoginPrefix || ''
  const templatePrefix = getEmailTemplatePrefix(dbLoginPrefix)

  const nameOrId = event.context.params?.id

  if (!nameOrId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing template id'
    })
  }

  const payload = await readBody<Record<string, unknown>>(event)

  if (!payload || typeof payload !== 'object') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid payload'
    })
  }

  // Client sends stripped name, construct full ID
  const fullTemplateId = nameOrId.startsWith(templatePrefix) 
    ? nameOrId 
    : `${templatePrefix}${nameOrId}`

  // If payload has _id, it should match (either stripped or full)
  if (payload._id && payload._id !== nameOrId && payload._id !== fullTemplateId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Payload id mismatch'
    })
  }

  const revision = payload._rev

  if (typeof revision !== 'string' || !revision) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Document revision is required'
    })
  }

  const mjml = typeof payload.mjml === 'string' ? payload.mjml : ''
  const html = typeof payload.html === 'string' ? payload.html : ''
  const subject = typeof payload.subject === 'string' ? payload.subject : ''

  const params = extractTemplatePlaceholders(mjml, html)

  const document: Record<string, unknown> = {
    ...payload,
    _id: fullTemplateId,
    _rev: revision,
    subject,
    mjml,
    html,
    params
  }

  await putDocument(EMAIL_DATABASE_NAME, document)

  const savedDocument = await getDocument<Record<string, unknown>>(EMAIL_DATABASE_NAME, fullTemplateId)

  // Return with stripped ID for client
  const responseDoc = savedDocument ?? document
  return {
    success: true,
    template: {
      ...responseDoc,
      _id: stripPrefix(responseDoc._id as string, templatePrefix)
    }
  }
})
