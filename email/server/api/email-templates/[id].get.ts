import { defineEventHandler, createError } from 'h3'
import { getDocument } from '#database/utils/couchdb'
import { assertAdminSession } from '#auth/server/utils/assert-admin-session'
import {
  EMAIL_DATABASE_NAME,
  getEmailTemplatePrefix
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

  // Client sends stripped name, construct full ID
  const fullTemplateId = nameOrId.startsWith(templatePrefix) 
    ? nameOrId 
    : `${templatePrefix}${nameOrId}`

  const template = await getDocument<Record<string, unknown>>(EMAIL_DATABASE_NAME, fullTemplateId)

  if (!template) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Template not found'
    })
  }

  // Return with stripped ID for client
  return {
    success: true,
    template: {
      ...template,
      _id: stripPrefix(template._id as string, templatePrefix)
    }
  }
})
