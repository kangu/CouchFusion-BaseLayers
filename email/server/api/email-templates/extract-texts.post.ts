import { createError, defineEventHandler, readBody } from 'h3'
import { assertAdminSession } from '#auth/server/utils/assert-admin-session'
import { extractEditableMjmlTexts } from '../../utils/email-templates'

interface ExtractTextsPayload {
  mjml?: string
}

export default defineEventHandler(async (event) => {
  await assertAdminSession(event)

  const payload = await readBody<ExtractTextsPayload>(event)
  const mjml = typeof payload?.mjml === 'string' ? payload.mjml : ''

  if (!mjml.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'MJML is required'
    })
  }

  const result = extractEditableMjmlTexts(mjml)

  return {
    success: true,
    texts: result.texts,
    transformedMjml: result.transformedMjml
  }
})
