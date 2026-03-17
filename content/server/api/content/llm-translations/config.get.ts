import { defineEventHandler } from 'h3'
import { requireAdminSession } from '../../../utils/auth'
import { getLlmTranslationsRuntimeConfig } from '../../../utils/llm-translations-config'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const runtimeConfig = await getLlmTranslationsRuntimeConfig()

  return {
    success: true,
    config: runtimeConfig.document.config,
    hasApiKey: Boolean(runtimeConfig.apiKey),
    updatedAt: runtimeConfig.document.updatedAt,
  }
})
