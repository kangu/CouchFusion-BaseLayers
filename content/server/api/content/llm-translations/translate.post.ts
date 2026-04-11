import { createError, defineEventHandler, readBody } from 'h3'
import { getAllDocs } from '#database/utils/couchdb'
import {
  buildLocalizedPath,
  isLocalizedValueMissing,
  resolveContentLocalePath,
} from '#content/utils/i18n'
import { clonePlain, contentToMinimalDocument, contentIdFromPath } from '#content/utils/page-documents'
import type { MinimalContentDocument } from '#content/app/utils/contentBuilder'
import { getContentDatabaseName } from '../../../utils/database'
import { requireAdminSession } from '../../../utils/auth'
import {
  buildLocaleDocumentIds,
  getLocaleDocumentId,
  readContentDocumentLocalizationMeta,
  resolveRequestedLocale,
  toPageDocumentRecord,
} from '../../../utils/content-i18n'
import { getEffectiveContentI18nConfig } from '../../../utils/content-i18n-settings'
import {
  applyTranslationsToBody,
  collectTranslatableTextEntries,
  readPointerTextValue,
  resolveFixedBodyPaths,
  resolveScopePointer,
  runLocaleTranslation,
  type TranslationOverwriteMode,
  type TranslationScopeMode,
  type TranslationTextEntry,
  type TranslationTokenUsage,
} from '../../../utils/llm-translations-run'
import { getLlmTranslationsRuntimeConfig } from '../../../utils/llm-translations-config'

const isPlainObject = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const toRowsById = (
  rows: Array<{ doc?: Record<string, any> }>,
): Map<string, Record<string, any>> => {
  const map = new Map<string, Record<string, any>>()

  for (const row of rows) {
    const doc = toPageDocumentRecord(row.doc)
    if (!doc || typeof doc._id !== 'string') {
      continue
    }
    map.set(doc._id, doc)
  }

  return map
}

const normalizeTargetLocales = (
  locales: unknown,
  sourceLocale: string,
  availableLocales: string[],
): string[] => {
  if (!Array.isArray(locales)) {
    return []
  }

  return Array.from(
    new Set(
      locales
        .map((entry) => resolveRequestedLocale(entry, {
          enabled: true,
          defaultLocale: sourceLocale,
          locales: availableLocales,
          prefixedLocales: availableLocales.filter((locale) => locale !== sourceLocale),
        }))
        .filter((locale) => locale !== sourceLocale && availableLocales.includes(locale)),
    ),
  )
}

const normalizeOverwriteMode = (value: unknown): TranslationOverwriteMode =>
  value === 'all' ? 'all' : 'missing'

const normalizeScopeMode = (value: unknown): TranslationScopeMode => {
  if (value === 'field' || value === 'section') {
    return value
  }
  return 'page'
}

const normalizeSelectedScopePointers = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter((entry) => entry.startsWith('/')),
    ),
  ).sort()
}

const filterEntriesBySelectedPointers = (
  entries: TranslationTextEntry[],
  selectedPointers: string[],
): TranslationTextEntry[] => {
  if (!selectedPointers.length) {
    return entries
  }

  return entries.filter((entry) =>
    selectedPointers.some((selectedPointer) =>
      entry.pointer === selectedPointer ||
      entry.pointer.startsWith(`${selectedPointer}/`),
    ),
  )
}

const withResolvedFixedBodyPaths = (
  document: MinimalContentDocument,
  fixedBodyPaths: string[],
): MinimalContentDocument => {
  const next = clonePlain(document)
  const nextMeta = isPlainObject(next.meta) ? clonePlain(next.meta) : {}
  const nextI18n = isPlainObject(nextMeta.contentI18n)
    ? clonePlain(nextMeta.contentI18n)
    : {}

  nextI18n.fixedBodyPaths = clonePlain(fixedBodyPaths)
  nextMeta.contentI18n = nextI18n
  next.meta = nextMeta

  return next
}

export const SEO_TITLE_POINTER = '/__seo/title'
export const SEO_DESCRIPTION_POINTER = '/__seo/description'

const isSeoPointer = (pointer: string): boolean =>
  pointer === SEO_TITLE_POINTER || pointer === SEO_DESCRIPTION_POINTER

export const collectPageSeoEntries = (
  document: MinimalContentDocument,
  scopeMode: TranslationScopeMode,
  scopePointer: string | null,
): TranslationTextEntry[] => {
  const includeAllSeoFields = scopeMode === 'page'
  const includeSeoTitle =
    includeAllSeoFields || (scopeMode === 'field' && scopePointer === SEO_TITLE_POINTER)
  const includeSeoDescription =
    includeAllSeoFields ||
    (scopeMode === 'field' && scopePointer === SEO_DESCRIPTION_POINTER)

  if (!includeSeoTitle && !includeSeoDescription) {
    return []
  }

  const entries: TranslationTextEntry[] = []
  const title = document.seo?.title
  const description = document.seo?.description

  if (includeSeoTitle && typeof title === 'string' && title.trim().length > 0) {
    entries.push({
      pointer: SEO_TITLE_POINTER,
      text: title,
    })
  }

  if (
    includeSeoDescription &&
    typeof description === 'string' &&
    description.trim().length > 0
  ) {
    entries.push({
      pointer: SEO_DESCRIPTION_POINTER,
      text: description,
    })
  }

  return entries
}

export const readTranslationTargetText = (
  document: MinimalContentDocument,
  pointer: string,
): string => {
  if (pointer === SEO_TITLE_POINTER) {
    return typeof document.seo?.title === 'string' ? document.seo.title : ''
  }
  if (pointer === SEO_DESCRIPTION_POINTER) {
    return typeof document.seo?.description === 'string'
      ? document.seo.description
      : ''
  }
  return readPointerTextValue(document.body.value, pointer)
}

export const splitTranslationsByPointer = (
  translationsByPointer: Record<string, string>,
): {
  bodyTranslations: Record<string, string>
  seoTranslations: Record<string, string>
} => {
  const bodyTranslations: Record<string, string> = {}
  const seoTranslations: Record<string, string> = {}

  for (const [pointer, value] of Object.entries(translationsByPointer)) {
    if (isSeoPointer(pointer)) {
      seoTranslations[pointer] = value
      continue
    }
    bodyTranslations[pointer] = value
  }

  return {
    bodyTranslations,
    seoTranslations,
  }
}

export const applyTranslationsToSeo = (
  document: MinimalContentDocument,
  translationsByPointer: Record<string, string>,
  overwriteMode: TranslationOverwriteMode,
): {
  appliedCount: number
  skippedCount: number
} => {
  let appliedCount = 0
  let skippedCount = 0

  for (const [pointer, translatedValue] of Object.entries(translationsByPointer)) {
    let currentValue: unknown
    let applyValue: ((value: string) => void) | null = null

    if (pointer === SEO_TITLE_POINTER) {
      currentValue = document.seo?.title
      applyValue = (value: string) => {
        if (!isPlainObject(document.seo)) {
          document.seo = { title: value, description: '', image: null }
          return
        }
        document.seo.title = value
      }
    } else if (pointer === SEO_DESCRIPTION_POINTER) {
      currentValue = document.seo?.description
      applyValue = (value: string) => {
        if (!isPlainObject(document.seo)) {
          document.seo = { title: '', description: value, image: null }
          return
        }
        document.seo.description = value
      }
    }

    if (!applyValue) {
      skippedCount += 1
      continue
    }

    if (overwriteMode === 'missing' && !isLocalizedValueMissing(currentValue)) {
      skippedCount += 1
      continue
    }

    applyValue(translatedValue)
    appliedCount += 1
  }

  return {
    appliedCount,
    skippedCount,
  }
}

const ensureMinimalDocument = (value: unknown): MinimalContentDocument => {
  if (!isPlainObject(value)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid payload: sourceDocument is required',
    })
  }

  const body = isPlainObject(value.body) ? value.body : {}
  const bodyValue = Array.isArray(body.value) ? body.value : []
  const seo = isPlainObject(value.seo) ? value.seo : {}
  const path = typeof value.path === 'string' ? value.path : '/'
  const title = typeof value.title === 'string' ? value.title : 'Page title'

  return {
    id: typeof value.id === 'string' ? value.id : contentIdFromPath(path),
    path,
    title,
    body: {
      type: 'minimal',
      value: clonePlain(bodyValue),
    },
    seo: {
      title: typeof seo.title === 'string' ? seo.title : title,
      description: typeof seo.description === 'string' ? seo.description : 'SEO description.',
      image: typeof seo.image === 'string' ? seo.image : null,
    },
    meta: isPlainObject(value.meta) ? clonePlain(value.meta) : {},
    navigation: typeof value.navigation === 'boolean' ? value.navigation : true,
    extension: typeof value.extension === 'string' ? value.extension : 'md',
    stem: typeof value.stem === 'string' ? value.stem : null,
    layout: isPlainObject(value.layout) ? clonePlain(value.layout) : undefined,
  }
}

const resolveLocaleTranslationError = (error: any): string => {
  const explicitMessage =
    typeof error?.message === 'string' && error.message.trim().length > 0
      ? error.message.trim()
      : null

  const statusMessage =
    typeof error?.statusMessage === 'string' && error.statusMessage.trim().length > 0
      ? error.statusMessage.trim()
      : null

  const providerResponseText =
    typeof error?.data?.providerResponseText === 'string' &&
    error.data.providerResponseText.trim().length > 0
      ? error.data.providerResponseText.trim()
      : null

  const providerStatus =
    typeof error?.data?.providerStatus === 'number' ? error.data.providerStatus : null

  if (providerResponseText) {
    if (explicitMessage?.includes(providerResponseText)) {
      return explicitMessage
    }
    const prefix = explicitMessage || statusMessage || 'Translation failed'
    const statusSuffix = providerStatus ? ` (${providerStatus})` : ''
    return `${prefix}${statusSuffix}: ${providerResponseText}`
  }

  return explicitMessage || statusMessage || 'Translation failed'
}

const toLocaleTranslationEntries = (
  translationsByPointer: Record<string, string>,
  sourceTextByPointer: Record<string, string>,
): Array<{ key: string; original: string; value: string }> =>
  Object.entries(translationsByPointer)
    .filter(
      (entry): entry is [string, string] =>
        typeof entry[0] === 'string' && typeof entry[1] === 'string',
    )
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => ({
      key,
      original:
        typeof sourceTextByPointer[key] === 'string' ? sourceTextByPointer[key] : '',
      value,
    }))

const normalizeTokenUsage = (value: unknown): TranslationTokenUsage | null => {
  if (!isPlainObject(value)) {
    return null
  }

  const promptTokens = Number.isFinite(value.promptTokens)
    ? Number(value.promptTokens)
    : 0
  const completionTokens = Number.isFinite(value.completionTokens)
    ? Number(value.completionTokens)
    : 0
  const totalTokens = Number.isFinite(value.totalTokens)
    ? Number(value.totalTokens)
    : 0
  const reasoningTokens = Number.isFinite(value.reasoningTokens)
    ? Number(value.reasoningTokens)
    : null
  const cachedPromptTokens = Number.isFinite(value.cachedPromptTokens)
    ? Number(value.cachedPromptTokens)
    : null

  if (promptTokens + completionTokens + totalTokens === 0) {
    return null
  }

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    reasoningTokens,
    cachedPromptTokens,
  }
}

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const body = await readBody<{
    path?: unknown
    sourceLocale?: unknown
    targetLocales?: unknown
    scopeMode?: unknown
    scopePointer?: unknown
    overwriteMode?: unknown
    selectedScopePointers?: unknown
    sourceDocument?: unknown
  }>(event)

  if (!isPlainObject(body)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid payload',
    })
  }

  const sourceDocument = ensureMinimalDocument(body.sourceDocument)
  const { effective: i18nConfig } = await getEffectiveContentI18nConfig()
  const requestedPath = typeof body.path === 'string' ? body.path : sourceDocument.path
  const resolvedPath = resolveContentLocalePath(requestedPath, i18nConfig)
  const basePath = resolvedPath.basePath
  const sourceLocale = resolveRequestedLocale(
    body.sourceLocale ?? resolvedPath.locale,
    i18nConfig,
  )

  const targetLocales = normalizeTargetLocales(
    body.targetLocales,
    sourceLocale,
    i18nConfig.locales,
  )

  if (!targetLocales.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No target locales selected',
    })
  }

  const scopeMode = normalizeScopeMode(body.scopeMode)
  const scopePointer = resolveScopePointer(scopeMode, body.scopePointer)
  const overwriteMode = normalizeOverwriteMode(body.overwriteMode)

  const databaseName = getContentDatabaseName()
  const documentIds = buildLocaleDocumentIds(basePath, i18nConfig)
  const allDocs = await getAllDocs(databaseName, {
    keys: documentIds,
    include_docs: true,
  })
  const rows = Array.isArray(allDocs?.rows) ? allDocs.rows : []
  const docsById = toRowsById(rows as Array<{ doc?: Record<string, any> }>)

  const masterId = getLocaleDocumentId(basePath, i18nConfig.defaultLocale, i18nConfig)
  const masterDocument = docsById.get(masterId)

  if (!masterDocument) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Master page document not found',
    })
  }

  const masterMeta = readContentDocumentLocalizationMeta(masterDocument, i18nConfig)
  const incomingMeta = isPlainObject(sourceDocument.meta) ? sourceDocument.meta : {}
  const incomingI18n = isPlainObject(incomingMeta.contentI18n) ? incomingMeta.contentI18n : {}
  const fixedBodyPaths = resolveFixedBodyPaths(
    incomingI18n.fixedBodyPaths,
    masterMeta.fixedBodyPaths,
  )

  const sourceBodyEntries = collectTranslatableTextEntries(
    sourceDocument.body.value,
    fixedBodyPaths,
    scopeMode,
    scopePointer,
  )
  const sourceEntries = [
    ...sourceBodyEntries,
    ...collectPageSeoEntries(sourceDocument, scopeMode, scopePointer),
  ]
  const selectedScopePointers = normalizeSelectedScopePointers(body.selectedScopePointers)
  const filteredSourceEntries = filterEntriesBySelectedPointers(
    sourceEntries,
    selectedScopePointers,
  )
  const sourceTextByPointer = Object.fromEntries(
    filteredSourceEntries.map((entry) => [entry.pointer, entry.text]),
  )

  if (!filteredSourceEntries.length) {
    return {
      success: true,
      sourceLocale,
      path: basePath,
      scopeMode,
      scopePointer,
      overwriteMode,
      report: {
        totalSourceEntries: 0,
        keyPoints: selectedScopePointers.length
          ? ['No localizable source text entries found for the selected checked fields.']
          : ['No localizable source text entries found for the selected scope.'],
        localeResults: [],
        completedAt: new Date().toISOString(),
      },
      stagedDocumentsByLocale: {},
    }
  }

  const runtimeConfig = await getLlmTranslationsRuntimeConfig()
  const stagedDocumentsByLocale: Record<string, MinimalContentDocument> = {}
  const localeResults: Array<Record<string, any>> = []
  const keyPoints: string[] = []

  for (const targetLocale of targetLocales) {
    try {
      const localeId = getLocaleDocumentId(basePath, targetLocale, i18nConfig)
      const localeDocument = docsById.get(localeId)

      const baseMinimal = localeDocument
        ? contentToMinimalDocument(localeDocument as any)
        : (() => {
            const cloned = clonePlain(sourceDocument)
            const localizedPath = buildLocalizedPath(basePath, targetLocale, i18nConfig)
            cloned.path = localizedPath
            cloned.id = contentIdFromPath(localizedPath)
            return cloned
          })()

      const eligibleEntries = filteredSourceEntries
        .map((entry) => {
          const normalizedTargetText = readTranslationTargetText(baseMinimal, entry.pointer)

          return {
            ...entry,
            targetText: normalizedTargetText,
          }
        })
        .filter((entry) =>
          overwriteMode === 'all'
            ? true
            : isLocalizedValueMissing(entry.targetText),
        )

      const translationResult = await runLocaleTranslation(runtimeConfig, {
        sourceLocale,
        targetLocale,
        entries: eligibleEntries,
        logContext: {
          path: basePath,
          scopeMode,
          scopePointer,
          overwriteMode,
          sourceEntryCount: filteredSourceEntries.length,
          eligibleEntryCount: eligibleEntries.length,
        },
      })

      const split = splitTranslationsByPointer(translationResult.translationsByPointer)
      const bodyApplied = applyTranslationsToBody(
        baseMinimal.body.value,
        split.bodyTranslations,
        overwriteMode,
        {
          sourceBodyValue: sourceDocument.body.value,
        },
      )
      baseMinimal.body.value = Array.isArray(bodyApplied.nextBodyValue)
        ? bodyApplied.nextBodyValue
        : baseMinimal.body.value
      const seoApplied = applyTranslationsToSeo(
        baseMinimal,
        split.seoTranslations,
        overwriteMode,
      )
      baseMinimal.path = buildLocalizedPath(basePath, targetLocale, i18nConfig)

      translationResult.appliedCount = bodyApplied.appliedCount + seoApplied.appliedCount
      translationResult.skippedCount =
        bodyApplied.skippedCount +
        seoApplied.skippedCount +
        (filteredSourceEntries.length - eligibleEntries.length)
      stagedDocumentsByLocale[targetLocale] = withResolvedFixedBodyPaths(
        baseMinimal,
        fixedBodyPaths,
      )

      localeResults.push({
        locale: targetLocale,
        status: 'ok',
        translatedCount: translationResult.translatedCount,
        appliedCount: translationResult.appliedCount,
        skippedCount: translationResult.skippedCount,
        notes: translationResult.notes,
        tokenUsage: translationResult.tokenUsage ?? null,
        translations: toLocaleTranslationEntries(
          translationResult.translationsByPointer,
          sourceTextByPointer,
        ),
      })

      if (translationResult.notes.length) {
        keyPoints.push(...translationResult.notes.map((note) => `[${targetLocale}] ${note}`))
      }
    } catch (error: any) {
      localeResults.push({
        locale: targetLocale,
        status: 'error',
        translatedCount: 0,
        appliedCount: 0,
        skippedCount: 0,
        error: resolveLocaleTranslationError(error),
        tokenUsage: normalizeTokenUsage(error?.data?.tokenUsage),
        translations: [],
      })
    }
  }

  return {
    success: true,
    sourceLocale,
    path: basePath,
    scopeMode,
    scopePointer,
    overwriteMode,
    report: {
      totalSourceEntries: filteredSourceEntries.length,
      keyPoints,
      localeResults,
      completedAt: new Date().toISOString(),
    },
    stagedDocumentsByLocale,
  }
})
