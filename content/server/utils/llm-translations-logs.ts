import type { CouchDBDocument } from '#database/utils/couchdb'
import { putDocument } from '#database/utils/couchdb'
import { getContentDatabaseName } from './database'

export type LlmTranslationLogStatus =
  | 'success'
  | 'provider_error'
  | 'response_error'

export interface LlmTranslationLogPayload {
  sourceLocale: string
  targetLocale: string
  entryCount: number
  requestBody: Record<string, any>
  status: LlmTranslationLogStatus
  durationMs: number
  context?: Record<string, unknown>
  responseBody?: Record<string, any> | null
  responseContent?: string | null
  translationsByPointer?: Record<string, string>
  notes?: string[]
  error?: {
    message: string
    status?: number
    statusText?: string | null
    responseText?: string | null
  }
}

interface LlmTranslationLogDocument extends CouchDBDocument {
  type: 'llm-translation-log'
  createdAt: string
  sourceLocale: string
  targetLocale: string
  entryCount: number
  status: LlmTranslationLogStatus
  durationMs: number
  requestBody: Record<string, any>
  context?: Record<string, unknown>
  responseBody?: Record<string, any> | null
  responseContent?: string | null
  translationsByPointer?: Record<string, string>
  notes?: string[]
  error?: {
    message: string
    status?: number
    statusText?: string | null
    responseText?: string | null
  }
}

const createLogDocumentId = (timestamp: string): string => {
  const randomPart =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`
  return `llm-translation-log:${timestamp}:${randomPart}`
}

export const persistLlmTranslationLog = async (
  payload: LlmTranslationLogPayload,
): Promise<void> => {
  try {
    const createdAt = new Date().toISOString()
    const databaseName = getContentDatabaseName()
    const document: LlmTranslationLogDocument = {
      _id: createLogDocumentId(createdAt),
      type: 'llm-translation-log',
      createdAt,
      sourceLocale: payload.sourceLocale,
      targetLocale: payload.targetLocale,
      entryCount: payload.entryCount,
      status: payload.status,
      durationMs: payload.durationMs,
      requestBody: payload.requestBody,
      context: payload.context,
      responseBody: payload.responseBody ?? null,
      responseContent: payload.responseContent ?? null,
      translationsByPointer: payload.translationsByPointer,
      notes: payload.notes,
      error: payload.error,
    }

    await putDocument(databaseName, document)
  } catch (error) {
    console.warn(
      '[content][llm-translations] failed to persist llm translation log:',
      error,
    )
  }
}
