import type { CouchDBDocument } from '#database/utils/couchdb'
import { couchDBRequest, getDocument, putDocument } from '#database/utils/couchdb'
import { createError } from 'h3'
import { getContentDatabaseName } from './database'

const LLM_TRANSLATIONS_DOC_ID = 'llm-translations'
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1'
const DEFAULT_MODEL = 'gpt-5.2'
const DEFAULT_COUCHDB_URL = 'http://localhost:5984'

export interface LlmTranslationsPromptConfig {
  system: string
  userTemplate: string
}

export interface LlmTranslationsRequestConfig {
  maxCompletionTokens: number
  temperature: number
}

export interface LlmTranslationsConfigPayload {
  provider: 'openai-compatible'
  baseUrl: string
  model: string
  request: LlmTranslationsRequestConfig
  prompts: LlmTranslationsPromptConfig
}

export interface LlmTranslationsConfigDocument extends CouchDBDocument {
  _id: typeof LLM_TRANSLATIONS_DOC_ID
  type: 'llm-translations'
  createdAt: string
  updatedAt: string
  config: LlmTranslationsConfigPayload
}

export interface LlmTranslationsRuntimeConfig {
  apiKey: string | null
  document: LlmTranslationsConfigDocument
}

const defaultPromptConfig = (): LlmTranslationsPromptConfig => ({
  system:
    'You are a professional localization expert. Preserve meaning, tone, formatting, and product terminology.',
  userTemplate:
    'Translate the provided JSON payload from SOURCE_LOCALE to TARGET_LOCALE. Keep keys and structure identical and return strict JSON.',
})

const defaultDocumentPayload = (timestamp: string): LlmTranslationsConfigDocument => ({
  _id: LLM_TRANSLATIONS_DOC_ID,
  type: 'llm-translations',
  createdAt: timestamp,
  updatedAt: timestamp,
  config: {
    provider: 'openai-compatible',
    baseUrl: DEFAULT_OPENAI_BASE_URL,
    model: DEFAULT_MODEL,
    request: {
      maxCompletionTokens: 1800,
      temperature: 0.1,
    },
    prompts: defaultPromptConfig(),
  },
})

const normalizePromptConfig = (value: unknown): LlmTranslationsPromptConfig => {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const defaults = defaultPromptConfig()
  return {
    system:
      typeof source.system === 'string' && source.system.trim()
        ? source.system.trim()
        : defaults.system,
    userTemplate:
      typeof source.userTemplate === 'string' && source.userTemplate.trim()
        ? source.userTemplate.trim()
        : defaults.userTemplate,
  }
}

const normalizeRequestConfig = (value: unknown): LlmTranslationsRequestConfig => {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const maxCompletionTokens =
    typeof source.maxCompletionTokens === 'number' && Number.isFinite(source.maxCompletionTokens)
      ? Math.max(200, Math.floor(source.maxCompletionTokens))
      : 1800
  const temperature =
    typeof source.temperature === 'number' && Number.isFinite(source.temperature)
      ? Math.min(Math.max(source.temperature, 0), 2)
      : 0.1

  return {
    maxCompletionTokens,
    temperature,
  }
}

const normalizeConfigPayload = (value: unknown): LlmTranslationsConfigPayload => {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {}

  return {
    provider: 'openai-compatible',
    baseUrl:
      typeof source.baseUrl === 'string' && source.baseUrl.trim()
        ? source.baseUrl.trim().replace(/\/$/, '')
        : DEFAULT_OPENAI_BASE_URL,
    model:
      typeof source.model === 'string' && source.model.trim()
        ? source.model.trim()
        : DEFAULT_MODEL,
    request: normalizeRequestConfig(source.request),
    prompts: normalizePromptConfig(source.prompts),
  }
}

const normalizeConfigDocument = (value: Record<string, any>): LlmTranslationsConfigDocument => {
  const now = new Date().toISOString()
  const source = value && typeof value === 'object' ? value : {}

  return {
    _id: LLM_TRANSLATIONS_DOC_ID,
    _rev: typeof source._rev === 'string' ? source._rev : undefined,
    type: 'llm-translations',
    createdAt:
      typeof source.createdAt === 'string' && source.createdAt.trim()
        ? source.createdAt
        : now,
    updatedAt:
      typeof source.updatedAt === 'string' && source.updatedAt.trim()
        ? source.updatedAt
        : now,
    config: normalizeConfigPayload(source.config),
  }
}

const parseConfigString = (value: string): string | null => {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (typeof parsed === 'string' && parsed.trim()) {
        return parsed.trim()
      }
    } catch {
      return trimmed.slice(1, -1).trim() || null
    }
  }

  return trimmed
}

const readOpenAiApiKeyFromCouchConfig = async (): Promise<string | null> => {
  try {
    const baseUrl = process.env.COUCHDB_URL || DEFAULT_COUCHDB_URL
    const response = await couchDBRequest(
      `${baseUrl}/_node/_local/_config/cf_openai/api_key`,
      { method: 'GET' },
    )

    if (!response.ok) {
      return null
    }

    const raw = await response.text()
    return parseConfigString(raw)
  } catch (error) {
    console.warn('[content][llm-translations] failed to read cf_openai.api_key:', error)
    return null
  }
}

let cachedRuntimeConfig: LlmTranslationsRuntimeConfig | null = null

export const ensureLlmTranslationsConfigDocument = async (): Promise<LlmTranslationsConfigDocument> => {
  const databaseName = getContentDatabaseName()
  const existing = await getDocument<LlmTranslationsConfigDocument>(databaseName, LLM_TRANSLATIONS_DOC_ID)

  if (existing) {
    const normalized = normalizeConfigDocument(existing as Record<string, any>)
    if (
      JSON.stringify({
        type: existing.type,
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt,
        config: existing.config,
      }) !==
      JSON.stringify({
        type: normalized.type,
        createdAt: normalized.createdAt,
        updatedAt: normalized.updatedAt,
        config: normalized.config,
      })
    ) {
      const updatedDocument: LlmTranslationsConfigDocument = {
        ...normalized,
        _rev: existing._rev,
        updatedAt: new Date().toISOString(),
      }
      const response = await putDocument(databaseName, updatedDocument)
      updatedDocument._rev = response.rev
      return updatedDocument
    }

    return normalized
  }

  const now = new Date().toISOString()
  const created = defaultDocumentPayload(now)
  const response = await putDocument(databaseName, created)
  created._rev = response.rev
  return created
}

export const refreshLlmTranslationsRuntimeConfig = async (): Promise<LlmTranslationsRuntimeConfig> => {
  const [document, apiKey] = await Promise.all([
    ensureLlmTranslationsConfigDocument(),
    readOpenAiApiKeyFromCouchConfig(),
  ])

  cachedRuntimeConfig = {
    document,
    apiKey,
  }

  return cachedRuntimeConfig
}

export const getLlmTranslationsRuntimeConfig = async (): Promise<LlmTranslationsRuntimeConfig> => {
  if (cachedRuntimeConfig) {
    return cachedRuntimeConfig
  }

  return await refreshLlmTranslationsRuntimeConfig()
}

export const assertLlmTranslationsApiKey = (apiKey: string | null): string => {
  if (!apiKey || !apiKey.trim()) {
    throw createError({
      statusCode: 500,
      statusMessage: 'LLM translation API key is not configured (cf_openai.api_key)',
    })
  }
  return apiKey.trim()
}
