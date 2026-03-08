import { createError } from 'h3'
import { isLocalizedValueMissing, getValueAtPath, setValueAtPath } from '#content/utils/i18n'
import { clonePlain } from '#content/utils/page-documents'
import { parseBodyPathPointer, toBodyPathPointer } from './content-i18n'
import type { LlmTranslationsRuntimeConfig } from './llm-translations-config'
import { assertLlmTranslationsApiKey } from './llm-translations-config'
import { persistLlmTranslationLog } from './llm-translations-logs'

type PathSegment = string | number

export type TranslationScopeMode = 'page' | 'section' | 'field'
export type TranslationOverwriteMode = 'missing' | 'all'

export interface TranslationTextEntry {
  pointer: string
  text: string
  targetText?: string
}

export interface TranslationLocaleExecutionResult {
  locale: string
  translatedCount: number
  appliedCount: number
  skippedCount: number
  notes: string[]
  error?: string
  translationsByPointer: Record<string, string>
  tokenUsage?: TranslationTokenUsage
}

export interface TranslationTokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  reasoningTokens?: number | null
  cachedPromptTokens?: number | null
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const parseJsonString = (value: string): unknown | null => {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const normalizePointer = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  if (!trimmed.startsWith('/')) {
    return null
  }
  return trimmed
}

const normalizeFixedBodyPaths = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return Array.from(
    new Set(
      value.filter(
        (entry): entry is string =>
          typeof entry === 'string' && entry.startsWith('/'),
      ),
    ),
  ).sort()
}

const pointerMatchesScope = (
  pointer: string,
  scopeMode: TranslationScopeMode,
  scopePointer: string | null,
): boolean => {
  if (scopeMode === 'page') {
    return true
  }

  if (!scopePointer) {
    return false
  }

  return pointer === scopePointer || pointer.startsWith(`${scopePointer}/`)
}

const pointerIsFixed = (pointer: string, fixedPointers: string[]): boolean =>
  fixedPointers.some((fixed) => pointer === fixed || pointer.startsWith(`${fixed}/`))

const isMinimarkEntry = (value: unknown): value is unknown[] =>
  Array.isArray(value) && typeof value[0] === 'string'

const shouldSkipPropKey = (key: string): boolean => {
  if (!key || typeof key !== 'string') {
    return true
  }

  if (key.startsWith('__builder') || key.startsWith('__content')) {
    return true
  }

  if (
    key === 'class' ||
    key === 'className' ||
    key === 'style' ||
    key === 'slot' ||
    key === 'id' ||
    key === '_id' ||
    key === '_rev'
  ) {
    return true
  }

  if (key.startsWith('v-slot:')) {
    return true
  }

  return false
}

const collectStringPointersFromPropValue = (
  value: unknown,
  path: PathSegment[],
  pointers: string[],
): void => {
  if (typeof value === 'string') {
    pointers.push(toBodyPathPointer(path))
    return
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      collectStringPointersFromPropValue(entry, [...path, index], pointers),
    )
    return
  }

  if (!isPlainObject(value)) {
    return
  }

  for (const [key, entry] of Object.entries(value)) {
    if (shouldSkipPropKey(key)) {
      continue
    }
    collectStringPointersFromPropValue(entry, [...path, key], pointers)
  }
}

const collectMinimarkStringPointers = (
  value: unknown,
  path: PathSegment[],
  pointers: string[],
): void => {
  if (typeof value === 'string') {
    pointers.push(toBodyPathPointer(path))
    return
  }

  if (!Array.isArray(value)) {
    return
  }

  if (isMinimarkEntry(value)) {
    const propsIndex = isPlainObject(value[1]) ? 1 : -1

    if (propsIndex === 1) {
      const rawProps = value[1] as Record<string, unknown>
      for (const [propKey, propValue] of Object.entries(rawProps)) {
        if (shouldSkipPropKey(propKey)) {
          continue
        }

        if (propKey.startsWith(':') && typeof propValue === 'string') {
          const normalizedKey = propKey.slice(1)
          if (normalizedKey.length > 0) {
            const parsed = parseJsonString(propValue)
            collectStringPointersFromPropValue(
              parsed ?? propValue,
              [...path, propsIndex, normalizedKey],
              pointers,
            )
            continue
          }
        }

        collectStringPointersFromPropValue(
          propValue,
          [...path, propsIndex, propKey],
          pointers,
        )
      }
    }

    const childrenStartIndex = propsIndex === 1 ? 2 : 1
    for (let index = childrenStartIndex; index < value.length; index += 1) {
      collectMinimarkStringPointers(value[index], [...path, index], pointers)
    }
    return
  }

  for (let index = 0; index < value.length; index += 1) {
    collectMinimarkStringPointers(value[index], [...path, index], pointers)
  }
}

type ResolvedPointerTarget =
  | {
      mode: 'direct'
      value: unknown
      path: PathSegment[]
    }
  | {
      mode: 'encoded'
      value: unknown
      encodedPath: PathSegment[]
      nestedPath: PathSegment[]
      parsedRoot: unknown
    }

const resolveEncodedPointerTarget = (
  bodyValue: unknown,
  path: PathSegment[],
  sourceBodyValue?: unknown,
): ResolvedPointerTarget | null => {
  for (let index = 0; index < path.length; index += 1) {
    const segment = path[index]
    if (typeof segment !== 'string' || segment.startsWith(':')) {
      continue
    }

    const encodedPath = [...path.slice(0, index), `:${segment}`]
    const encodedRaw = getValueAtPath(bodyValue, encodedPath)
    if (typeof encodedRaw !== 'string') {
      if (typeof encodedRaw !== 'undefined') {
        continue
      }

      if (!sourceBodyValue) {
        continue
      }

      const sourceEncodedRaw = getValueAtPath(sourceBodyValue, encodedPath)
      if (typeof sourceEncodedRaw !== 'string') {
        continue
      }

      const sourceParsedRoot = parseJsonString(sourceEncodedRaw)
      if (sourceParsedRoot === null) {
        continue
      }

      const nestedPath = path.slice(index + 1)
      const encodedValue =
        nestedPath.length > 0
          ? getValueAtPath(sourceParsedRoot, nestedPath)
          : sourceParsedRoot

      return {
        mode: 'encoded',
        value: encodedValue,
        encodedPath,
        nestedPath,
        parsedRoot: sourceParsedRoot,
      }
    }

    const parsedRoot = parseJsonString(encodedRaw)
    if (parsedRoot === null) {
      continue
    }

    const nestedPath = path.slice(index + 1)
    const encodedValue =
      nestedPath.length > 0 ? getValueAtPath(parsedRoot, nestedPath) : parsedRoot

    return {
      mode: 'encoded',
      value: encodedValue,
      encodedPath,
      nestedPath,
      parsedRoot,
    }
  }

  return null
}

const resolvePointerTarget = (
  bodyValue: unknown,
  path: PathSegment[],
  sourceBodyValue?: unknown,
): ResolvedPointerTarget | null => {
  const encodedTarget = resolveEncodedPointerTarget(
    bodyValue,
    path,
    sourceBodyValue,
  )
  if (encodedTarget) {
    return encodedTarget
  }

  const directValue = getValueAtPath(bodyValue, path)
  if (typeof directValue !== 'undefined') {
    return {
      mode: 'direct',
      value: directValue,
      path,
    }
  }

  if (path.length > 0) {
    const parentPath = path.slice(0, -1)
    const leaf = path[path.length - 1]
    const parentValue = parentPath.length > 0
      ? getValueAtPath(bodyValue, parentPath)
      : bodyValue

    if (Array.isArray(parentValue) && typeof leaf === 'number') {
      if (leaf >= 0 && leaf < parentValue.length) {
        return {
          mode: 'direct',
          value: parentValue[leaf],
          path,
        }
      }
    } else if (isPlainObject(parentValue) && typeof leaf === 'string') {
      return {
        mode: 'direct',
        value: parentValue[leaf],
        path,
      }
    }
  }

  return null
}

export const collectTranslatableTextEntries = (
  bodyValue: unknown,
  fixedBodyPaths: string[],
  scopeMode: TranslationScopeMode,
  scopePointer: string | null,
): TranslationTextEntry[] => {
  const stringPointers: string[] = []
  collectMinimarkStringPointers(bodyValue, [], stringPointers)

  return Array.from(new Set(stringPointers))
    .filter((pointer) => pointerMatchesScope(pointer, scopeMode, scopePointer))
    .filter((pointer) => !pointerIsFixed(pointer, fixedBodyPaths))
    .map((pointer) => {
      const path = parseBodyPathPointer(pointer)
      const resolved = resolvePointerTarget(bodyValue, path)
      return {
        pointer,
        text: String(resolved?.value ?? ''),
      }
    })
    .filter((entry) => entry.text.trim().length > 0)
}

export const readPointerTextValue = (
  bodyValue: unknown,
  pointer: string,
): string => {
  const path = parseBodyPathPointer(pointer)
  if (!path.length) {
    return ''
  }

  const resolved = resolvePointerTarget(bodyValue, path)
  return typeof resolved?.value === 'string' ? resolved.value : ''
}

interface ParsedTranslationResponse {
  translationsByIndex: Record<string, string>
  notes: string[]
}

const normalizeNumber = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return 0
  }
  return Math.floor(value)
}

const readTokenUsageFromCompletion = (
  completion: Record<string, any> | null | undefined,
): TranslationTokenUsage | undefined => {
  if (!completion || typeof completion !== 'object') {
    return undefined
  }

  const usage = completion.usage
  if (!usage || typeof usage !== 'object') {
    return undefined
  }

  const promptTokens = normalizeNumber(usage.prompt_tokens)
  const completionTokens = normalizeNumber(usage.completion_tokens)
  const totalTokens = normalizeNumber(usage.total_tokens)
  const reasoningTokens = normalizeNumber(
    usage.completion_tokens_details?.reasoning_tokens,
  )
  const cachedPromptTokens = normalizeNumber(
    usage.prompt_tokens_details?.cached_tokens,
  )

  if (promptTokens + completionTokens + totalTokens === 0) {
    return undefined
  }

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    reasoningTokens: reasoningTokens > 0 ? reasoningTokens : null,
    cachedPromptTokens: cachedPromptTokens > 0 ? cachedPromptTokens : null,
  }
}

const stripJsonCodeFence = (value: string): string => {
  const trimmed = value.trim()
  if (!trimmed.startsWith('```')) {
    return trimmed
  }

  return trimmed
    .replace(/^```[a-zA-Z]*\s*/, '')
    .replace(/\s*```$/, '')
    .trim()
}

const parseTranslationResponse = (raw: string): ParsedTranslationResponse => {
  const normalized = stripJsonCodeFence(raw)
  let parsed: unknown = null

  try {
    parsed = JSON.parse(normalized)
  } catch {
    const first = normalized.indexOf('{')
    const last = normalized.lastIndexOf('}')
    if (first !== -1 && last > first) {
      parsed = JSON.parse(normalized.slice(first, last + 1))
    }
  }

  if (!isPlainObject(parsed)) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Invalid translation response payload',
    })
  }

  const rawItems =
    Array.isArray(parsed.items)
      ? parsed.items
      : Array.isArray(parsed.translations)
        ? parsed.translations
        : []
  const translationsByIndex: Record<string, string> = {}

  for (const entry of rawItems) {
    if (!isPlainObject(entry)) {
      continue
    }
    const index =
      typeof entry.index === 'string'
        ? entry.index
        : typeof entry.id === 'string'
          ? entry.id
          : null
    const targetTranslation =
      typeof entry.target_translation === 'string'
        ? entry.target_translation
        : typeof entry.text === 'string'
          ? entry.text
          : null

    if (!index || targetTranslation === null) {
      continue
    }
    translationsByIndex[index] = targetTranslation
  }

  const notes: string[] = Array.isArray(parsed.notes)
    ? parsed.notes.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : typeof parsed.notes === 'string' && parsed.notes.trim().length > 0
      ? [parsed.notes.trim()]
      : []

  return {
    translationsByIndex,
    notes,
  }
}

const buildUserPrompt = (
  sourceLocale: string,
  targetLocale: string,
  entries: Array<{
    index: string
    source_translation: string
    target_translation: string
  }>,
  template: string,
): string => {
  return [
    template,
    'Translate only source_translation values and return only index + target_translation in strict JSON.',
    'Do not translate keys, identifiers, component/tag names, or JSON structure.',
    `SOURCE_LOCALE=${sourceLocale}`,
    `TARGET_LOCALE=${targetLocale}`,
    'INPUT_JSON:',
    JSON.stringify(
      {
        items: entries,
        outputContract: {
          items: [{ index: 'string', target_translation: 'string' }],
          notes: ['string'],
        },
      },
      null,
      2,
    ),
  ].join('\n\n')
}

export const runLocaleTranslation = async (
  runtimeConfig: LlmTranslationsRuntimeConfig,
  payload: {
    sourceLocale: string
    targetLocale: string
    entries: TranslationTextEntry[]
    logContext?: Record<string, unknown>
  },
): Promise<TranslationLocaleExecutionResult> => {
  const apiKey = assertLlmTranslationsApiKey(runtimeConfig.apiKey)
  const config = runtimeConfig.document.config
  const runStartedAt = Date.now()
  const requestEntries = payload.entries.map((entry) => ({
    index: entry.pointer,
    source_translation: entry.text,
    target_translation:
      typeof entry.targetText === 'string' ? entry.targetText : '',
  }))

  if (!requestEntries.length) {
    return {
      locale: payload.targetLocale,
      translatedCount: 0,
      appliedCount: 0,
      skippedCount: 0,
      notes: ['No eligible entries to translate for this locale.'],
      translationsByPointer: {},
    }
  }

  const requestBody = {
    model: config.model,
    temperature: config.request.temperature,
    max_completion_tokens: config.request.maxCompletionTokens,
    messages: [
      {
        role: 'system',
        content: config.prompts.system,
      },
      {
        role: 'user',
        content: buildUserPrompt(
          payload.sourceLocale,
          payload.targetLocale,
          requestEntries,
          config.prompts.userTemplate,
        ),
      },
    ],
  }

  // console.log(
  //   '[content][llm-translations] /chat/completions request body:',
  //   JSON.stringify(requestBody, null, 2),
  // )

  const persistLog = async (
    details: {
      status: 'success' | 'provider_error' | 'response_error'
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
    },
  ): Promise<void> => {
    await persistLlmTranslationLog({
      sourceLocale: payload.sourceLocale,
      targetLocale: payload.targetLocale,
      entryCount: requestEntries.length,
      requestBody,
      status: details.status,
      durationMs: Date.now() - runStartedAt,
      context: payload.logContext,
      responseBody: details.responseBody ?? null,
      responseContent: details.responseContent ?? null,
      translationsByPointer: details.translationsByPointer,
      notes: details.notes,
      error: details.error,
    })
  }

  const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const text = await response.text()
    console.error(
      '[content][llm-translations] /chat/completions failed:',
      JSON.stringify(
        {
          status: response.status,
          statusText: response.statusText,
          responseText: text,
        },
        null,
        2,
      ),
    )
    await persistLog({
      status: 'provider_error',
      error: {
        message: 'Translation API request failed',
        status: response.status,
        statusText: response.statusText || null,
        responseText: typeof text === 'string' ? text : null,
      },
    })
    const providerResponseText = typeof text === 'string' ? text.trim() : ''
    const providerDetails = providerResponseText || 'Unknown provider error'
    const providerStatus = `${response.status}${response.statusText ? ` ${response.statusText}` : ''}`
    throw createError({
      statusCode: response.status,
      statusMessage: 'Translation API request failed',
      message: `Translation API request failed (${providerStatus}): ${providerDetails}`,
      data: {
        providerStatus: response.status,
        providerStatusText: response.statusText || null,
        providerResponseText: providerResponseText || null,
      },
    })
  }

  const completion = await response.json() as Record<string, any>
  const tokenUsage = readTokenUsageFromCompletion(completion)
  // console.log(
  //   '[content][llm-translations] /chat/completions success response:',
  //   JSON.stringify(completion, null, 2),
  // )
  const rawContent = completion?.choices?.[0]?.message?.content

  if (typeof rawContent !== 'string' || !rawContent.trim()) {
    await persistLog({
      status: 'response_error',
      responseBody: completion,
      responseContent: typeof rawContent === 'string' ? rawContent : null,
      error: {
        message: 'Translation API returned empty content',
      },
    })
    throw createError({
      statusCode: 502,
      statusMessage: 'Translation API returned empty content',
      data: {
        tokenUsage: tokenUsage ?? null,
      },
    })
  }

  let parsed: ParsedTranslationResponse
  try {
    parsed = parseTranslationResponse(rawContent)
  } catch (error: any) {
    const message =
      typeof error?.message === 'string' && error.message.trim().length > 0
        ? error.message.trim()
        : 'Invalid translation response payload'
    await persistLog({
      status: 'response_error',
      responseBody: completion,
      responseContent: rawContent,
      error: {
        message,
      },
    })
    throw createError({
      statusCode: typeof error?.statusCode === 'number' ? error.statusCode : 502,
      statusMessage: message,
      data: {
        tokenUsage: tokenUsage ?? null,
      },
    })
  }
  const translationsByPointer: Record<string, string> = {}

  const pointerSet = new Set(payload.entries.map((entry) => entry.pointer))

  for (const [index, translated] of Object.entries(parsed.translationsByIndex)) {
    if (!pointerSet.has(index)) {
      continue
    }
    translationsByPointer[index] = translated
  }

  await persistLog({
    status: 'success',
    responseBody: completion,
    responseContent: rawContent,
    translationsByPointer,
    notes: parsed.notes,
  })

  return {
    locale: payload.targetLocale,
    translatedCount: Object.keys(translationsByPointer).length,
    appliedCount: 0,
    skippedCount: 0,
    notes: parsed.notes,
    translationsByPointer,
    tokenUsage,
  }
}

export const applyTranslationsToBody = (
  bodyValue: unknown,
  translationsByPointer: Record<string, string>,
  overwriteMode: TranslationOverwriteMode,
  options?: {
    sourceBodyValue?: unknown
  },
): {
  nextBodyValue: unknown
  appliedCount: number
  skippedCount: number
} => {
  let nextBody = clonePlain(bodyValue)
  let appliedCount = 0
  let skippedCount = 0

  for (const [pointer, translatedValue] of Object.entries(translationsByPointer)) {
    const path = parseBodyPathPointer(pointer)
    if (!path.length) {
      skippedCount += 1
      continue
    }

    const target = resolvePointerTarget(
      nextBody,
      path,
      options?.sourceBodyValue,
    )
    if (!target) {
      skippedCount += 1
      continue
    }

    const currentValue = target.value
    if (overwriteMode === 'missing' && !isLocalizedValueMissing(currentValue)) {
      skippedCount += 1
      continue
    }

    if (target.mode === 'direct') {
      nextBody = setValueAtPath(nextBody, target.path, translatedValue)
    } else {
      const nextParsedRoot =
        target.nestedPath.length > 0
          ? setValueAtPath(target.parsedRoot, target.nestedPath, translatedValue)
          : translatedValue
      nextBody = setValueAtPath(
        nextBody,
        target.encodedPath,
        JSON.stringify(nextParsedRoot),
      )

      // Keep legacy direct mirror props (if present) in sync with encoded values.
      const directExistingValue = getValueAtPath(nextBody, path)
      if (typeof directExistingValue !== 'undefined') {
        nextBody = setValueAtPath(nextBody, path, translatedValue)
      }
    }
    appliedCount += 1
  }

  return {
    nextBodyValue: nextBody,
    appliedCount,
    skippedCount,
  }
}

export const resolveScopePointer = (
  scopeMode: TranslationScopeMode,
  scopePointerInput: unknown,
): string | null => {
  if (scopeMode === 'page') {
    return null
  }

  return normalizePointer(scopePointerInput)
}

export const resolveFixedBodyPaths = (
  incomingFixedBodyPaths: unknown,
  existingFixedBodyPaths: unknown,
): string[] => {
  const incoming = normalizeFixedBodyPaths(incomingFixedBodyPaths)
  if (incoming.length > 0) {
    return incoming
  }
  return normalizeFixedBodyPaths(existingFixedBodyPaths)
}
