import { defineEventHandler, setResponseHeader } from 'h3'
import { getAllDocs } from '#database/utils/couchdb'
import { assertAdminSession } from '#auth/server/utils/assert-admin-session'
import {
  EMAIL_DATABASE_NAME,
  getEmailTemplatePrefix,
  getEmailTemplateEndKey
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
  setResponseHeader(event, 'Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  setResponseHeader(event, 'Pragma', 'no-cache')
  setResponseHeader(event, 'Expires', '0')
  await assertAdminSession(event)

  const runtimeConfig = useRuntimeConfig()
  const dbLoginPrefix = runtimeConfig.dbLoginPrefix || ''
  const templatePrefix = getEmailTemplatePrefix(dbLoginPrefix)
  const endKey = getEmailTemplateEndKey(templatePrefix)

  const result = await getAllDocs(EMAIL_DATABASE_NAME, {
    startkey: templatePrefix,
    endkey: endKey,
    include_docs: true
  })

  if (!result) {
    return {
      success: true,
      templates: [],
      total: 0
    }
  }

  // Strip prefixes from template IDs for client
  const templates = result.rows
    .map((row) => row.doc)
    .filter((doc): doc is Record<string, unknown> => !!doc)
    .map((doc) => ({
      ...doc,
      _id: stripPrefix(doc._id as string, templatePrefix)
    }))

  return {
    success: true,
    templates,
    total: templates.length
  }
})
