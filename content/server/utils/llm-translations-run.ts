import { createError } from 'h3'
import { isLocalizedValueMissing, getValueAtPath, setValueAtPath } from '#content/utils/i18n'
import { clonePlain } from '#content/utils/page-documents'
import { parseBodyPathPointer, toBodyPathPointer } from './content-i18n'
import type { LlmTranslationsRuntimeConfig } from './llm-translations-config'
import { assertLlmTranslationsApiKey } from './llm-translations-config'

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
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

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
    .map((pointer) => ({
      pointer,
      text: String(getValueAtPath(bodyValue, parseBodyPathPointer(pointer)) ?? ''),
    }))
    .filter((entry) => entry.text.trim().length > 0)
}

interface ParsedTranslationResponse {
  translationsByIndex: Record<string, string>
  notes: string[]
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
  },
): Promise<TranslationLocaleExecutionResult> => {
  const apiKey = assertLlmTranslationsApiKey(runtimeConfig.apiKey)
  const config = runtimeConfig.document.config
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

  console.log(
    '[content][llm-translations] /chat/completions request body:',
    JSON.stringify(requestBody, null, 2),
  )

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
  console.log(
    '[content][llm-translations] /chat/completions success response:',
    JSON.stringify(completion, null, 2),
  )
  const rawContent = completion?.choices?.[0]?.message?.content

  if (typeof rawContent !== 'string' || !rawContent.trim()) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Translation API returned empty content',
    })
  }

  const parsed = parseTranslationResponse(rawContent)
  const translationsByPointer: Record<string, string> = {}

  const pointerSet = new Set(payload.entries.map((entry) => entry.pointer))

  for (const [index, translated] of Object.entries(parsed.translationsByIndex)) {
    if (!pointerSet.has(index)) {
      continue
    }
    translationsByPointer[index] = translated
  }

  return {
    locale: payload.targetLocale,
    translatedCount: Object.keys(translationsByPointer).length,
    appliedCount: 0,
    skippedCount: 0,
    notes: parsed.notes,
    translationsByPointer,
  }
}

export const applyTranslationsToBody = (
  bodyValue: unknown,
  translationsByPointer: Record<string, string>,
  overwriteMode: TranslationOverwriteMode,
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

    const currentValue = getValueAtPath(nextBody, path)
    if (overwriteMode === 'missing' && !isLocalizedValueMissing(currentValue)) {
      skippedCount += 1
      continue
    }

    nextBody = setValueAtPath(nextBody, path, translatedValue)
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
  return Array.from(
    new Set([
      ...normalizeFixedBodyPaths(existingFixedBodyPaths),
      ...normalizeFixedBodyPaths(incomingFixedBodyPaths),
    ]),
  ).sort()
}
