import type { MinimalContentDocument } from '#content/app/utils/contentBuilder'

export type LlmTranslationScopeMode = 'page' | 'section' | 'field'
export type LlmTranslationOverwriteMode = 'missing' | 'all'

export interface LlmTranslationRunRequest {
  path: string
  sourceLocale: string
  targetLocales: string[]
  sourceDocument: MinimalContentDocument
  scopeMode: LlmTranslationScopeMode
  scopePointer?: string | null
  overwriteMode: LlmTranslationOverwriteMode
}

export interface LlmTranslationLocaleReportEntry {
  locale: string
  status: 'ok' | 'error'
  translatedCount: number
  appliedCount: number
  skippedCount: number
  notes?: string[]
  error?: string
  translations?: Array<{
    key: string
    value: string
  }>
}

export interface LlmTranslationRunResult {
  sourceLocale: string
  path: string
  scopeMode: LlmTranslationScopeMode
  scopePointer?: string | null
  overwriteMode: LlmTranslationOverwriteMode
  report: {
    totalSourceEntries: number
    keyPoints: string[]
    localeResults: LlmTranslationLocaleReportEntry[]
    completedAt: string
  }
  stagedDocumentsByLocale: Record<string, MinimalContentDocument>
}

const resolveRequestErrorMessage = (requestError: any): string => {
  const candidates = [
    requestError?.data?.message,
    requestError?.data?.statusMessage,
    requestError?.response?._data?.message,
    requestError?.response?._data?.statusMessage,
    requestError?.message,
  ]

  for (const entry of candidates) {
    if (typeof entry === 'string' && entry.trim().length > 0) {
      return entry.trim()
    }
  }

  return 'Translation failed'
}

export const useLlmTranslations = () => {
  const pending = ref(false)
  const error = ref<string | null>(null)
  const lastResult = ref<LlmTranslationRunResult | null>(null)

  const runTranslation = async (
    request: LlmTranslationRunRequest,
  ): Promise<LlmTranslationRunResult> => {
    pending.value = true
    error.value = null

    try {
      const $f = useRequestFetch()
      const response = await $f('/api/content/llm-translations/translate', {
        method: 'POST',
        body: request,
      }) as {
        success: boolean
      } & LlmTranslationRunResult

      if (!response?.success) {
        throw new Error('Translation request failed')
      }

      lastResult.value = {
        sourceLocale: response.sourceLocale,
        path: response.path,
        scopeMode: response.scopeMode,
        scopePointer: response.scopePointer ?? null,
        overwriteMode: response.overwriteMode,
        report: response.report,
        stagedDocumentsByLocale: response.stagedDocumentsByLocale ?? {},
      }

      return lastResult.value
    } catch (requestError: any) {
      const message = resolveRequestErrorMessage(requestError)
      error.value = message
      throw new Error(message)
    } finally {
      pending.value = false
    }
  }

  const reset = () => {
    error.value = null
    lastResult.value = null
  }

  return {
    pending: readonly(pending),
    error: readonly(error),
    lastResult: readonly(lastResult),
    runTranslation,
    reset,
  }
}
