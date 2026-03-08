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
  resolveRuntimeContentI18nConfig,
  toPageDocumentRecord,
} from '../../../utils/content-i18n'
import {
  applyTranslationsToBody,
  collectTranslatableTextEntries,
  readPointerTextValue,
  resolveFixedBodyPaths,
  resolveScopePointer,
  runLocaleTranslation,
  type TranslationOverwriteMode,
  type TranslationScopeMode,
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

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const body = await readBody<{
    path?: unknown
    sourceLocale?: unknown
    targetLocales?: unknown
    scopeMode?: unknown
    scopePointer?: unknown
    overwriteMode?: unknown
    sourceDocument?: unknown
  }>(event)

  if (!isPlainObject(body)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid payload',
    })
  }

  const sourceDocument = ensureMinimalDocument(body.sourceDocument)
  const i18nConfig = resolveRuntimeContentI18nConfig()
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

  const sourceEntries = collectTranslatableTextEntries(
    sourceDocument.body.value,
    fixedBodyPaths,
    scopeMode,
    scopePointer,
  )
  const sourceTextByPointer = Object.fromEntries(
    sourceEntries.map((entry) => [entry.pointer, entry.text]),
  )

  if (!sourceEntries.length) {
    return {
      success: true,
      sourceLocale,
      path: basePath,
      scopeMode,
      scopePointer,
      overwriteMode,
      report: {
        totalSourceEntries: 0,
        keyPoints: ['No localizable source text entries found for the selected scope.'],
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

      const eligibleEntries = sourceEntries
        .map((entry) => {
          const normalizedTargetText = readPointerTextValue(
            baseMinimal.body.value,
            entry.pointer,
          )

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
          sourceEntryCount: sourceEntries.length,
          eligibleEntryCount: eligibleEntries.length,
        },
      })

      const applied = applyTranslationsToBody(
        baseMinimal.body.value,
        translationResult.translationsByPointer,
        overwriteMode,
        {
          sourceBodyValue: sourceDocument.body.value,
        },
      )
      baseMinimal.body.value = Array.isArray(applied.nextBodyValue)
        ? applied.nextBodyValue
        : baseMinimal.body.value
      baseMinimal.path = buildLocalizedPath(basePath, targetLocale, i18nConfig)

      translationResult.appliedCount = applied.appliedCount
      translationResult.skippedCount =
        applied.skippedCount + (sourceEntries.length - eligibleEntries.length)
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
      totalSourceEntries: sourceEntries.length,
      keyPoints,
      localeResults,
      completedAt: new Date().toISOString(),
    },
    stagedDocumentsByLocale,
  }
})
