import { defineEventHandler, readBody, createError } from 'h3'
import { putDocument, getDocument } from '#database/utils/couchdb'
import { assertAdminSession } from '#auth/server/utils/assert-admin-session'
import {
  EMAIL_DATABASE_NAME,
  getEmailTemplatePrefix,
  extractTemplatePlaceholders
} from '../../utils/email-templates'

interface CreateEmailTemplatePayload {
  name?: string
  subject?: string
  mjml?: string
  html?: string
  editableMjmlBase?: string
  editableMjmlEntries?: unknown
}

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

  const payload = await readBody<CreateEmailTemplatePayload>(event)

  if (!payload || typeof payload !== 'object') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid payload'
    })
  }

  const templateName = (payload.name || '').trim()

  if (!templateName) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Template name is required'
    })
  }

  // Construct full ID with prefix
  const fullTemplateId = `${templatePrefix}${templateName}`

  const templateDocument = {
    _id: fullTemplateId,
    subject: typeof payload.subject === 'string' ? payload.subject : '',
    mjml: typeof payload.mjml === 'string' ? payload.mjml : '',
    html: typeof payload.html === 'string' ? payload.html : '',
    editableMjmlBase: typeof payload.editableMjmlBase === 'string' ? payload.editableMjmlBase : '',
    editableMjmlEntries: Array.isArray(payload.editableMjmlEntries) ? payload.editableMjmlEntries : [],
    params: extractTemplatePlaceholders(payload.mjml, payload.html)
  }

  await putDocument(EMAIL_DATABASE_NAME, templateDocument)

  const savedDocument = await getDocument<Record<string, unknown>>(EMAIL_DATABASE_NAME, fullTemplateId)

  // Return with stripped ID for client
  const responseDoc = savedDocument ?? templateDocument
  return {
    success: true,
    template: {
      ...responseDoc,
      _id: stripPrefix(responseDoc._id as string, templatePrefix)
    }
  }
})
