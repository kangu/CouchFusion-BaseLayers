import { createError } from 'h3'
import { bulkDocs, getAllDocs, putDocument } from '#database/utils/couchdb'
import { CONTENT_META_I18N_KEY } from '#content/utils/i18n'
import { normalizePagePath } from '#content/utils/page'
import { buildLocalizedPath, resolveContentLocalePath } from '#content/utils/i18n'
import { sanitiseIncomingDocument } from './content-documents'
import { savePageHistory } from './page-history'
import { getContentDatabaseName } from './database'
import {
  applyBodyPathsFromSource,
  applyFixedBodyPaths,
  buildLocaleDocumentIds,
  buildLocalizedBodyForRead,
  clonePageDocument,
  collectChangedFixedBodyPaths,
  countMissingLocalizedValues,
  ensureDocumentLocalizationMeta,
  getBodyValue,
  getLocaleDocumentId,
  mergeUpdatedAtByLocale,
  readContentDocumentLocalizationMeta,
  resolveRequestedLocale,
  setBodyValue,
  toPageDocumentRecord,
  valuesDeepEqual,
} from './content-i18n'
import { getEffectiveContentI18nConfig } from './content-i18n-settings'

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

const resolveEffectiveFixedBodyPaths = (
  existingFixedBodyPaths: unknown,
  incomingFixedBodyPaths: unknown,
): string[] => {
  const incoming = normalizeFixedBodyPaths(incomingFixedBodyPaths)
  if (incoming.length > 0) {
    // Builder-supplied fixed paths reflect the current component schema and
    // prevent stale master metadata from forcing unrelated propagation.
    return incoming
  }

  return normalizeFixedBodyPaths(existingFixedBodyPaths)
}

const getIncomingFixedBodyPaths = (document: Record<string, any>): string[] => {
  const rawMeta = isPlainObject(document.meta) ? document.meta : {}
  const rawI18n = isPlainObject(rawMeta[CONTENT_META_I18N_KEY])
    ? rawMeta[CONTENT_META_I18N_KEY]
    : {}

  return normalizeFixedBodyPaths(rawI18n.fixedBodyPaths)
}

const buildRootLegacyDocumentIds = (
  normalizedPath: string,
  locale: string,
  defaultLocale: string,
): { legacyMasterId: string | null; legacyLocaleId: string | null } => {
  if (normalizedPath !== '/') {
    return {
      legacyMasterId: null,
      legacyLocaleId: null,
    }
  }

  const legacyMasterId = 'page-/'
  return {
    legacyMasterId,
    legacyLocaleId: locale === defaultLocale ? legacyMasterId : `${legacyMasterId}::${locale}`,
  }
}

const toPersistableDocument = (document: Record<string, any>): Record<string, any> => {
  const next = clonePageDocument(document)
  next.type = 'page'
  next.path = normalizePagePath(next.path ?? '/')
  return next
}

const persistDocuments = async (
  databaseName: string,
  documents: Record<string, any>[],
): Promise<void> => {
  if (!documents.length) {
    return
  }

  if (documents.length === 1) {
    const [single] = documents
    const response = await putDocument(databaseName, single)
    if (response.rev) {
      single._rev = response.rev
    }
    return
  }

  const response = await bulkDocs(databaseName, documents)
  const failed = response.filter((entry) => !entry.ok)

  if (failed.length > 0) {
    const first = failed[0]
    throw createError({
      statusCode: 409,
      statusMessage: first.reason || first.error || 'Failed to persist localized page documents',
    })
  }

  const revisionById = new Map(
    response
      .filter((entry) => entry.ok && typeof entry.id === 'string' && typeof entry.rev === 'string')
      .map((entry) => [entry.id, entry.rev as string]),
  )

  for (const doc of documents) {
    const revision = revisionById.get(doc._id)
    if (revision) {
      doc._rev = revision
    }
  }
}

export interface SaveLocalizedPageResult {
  page: Record<string, any>
  locale: string
  defaultLocale: string
  updatedAtByLocale: Record<string, string>
  hasLocaleDocument: boolean
  missingLocalizedCount: number
}

export const saveLocalizedPageDocument = async (
  payload: { document: any; locale?: unknown },
  options: { isCreate: boolean },
): Promise<SaveLocalizedPageResult> => {
  if (!payload || !isPlainObject(payload.document)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid payload: document is required',
    })
  }

  const { effective: contentI18nConfig } = await getEffectiveContentI18nConfig()
  const requestedPath = normalizePagePath(payload.document.path ?? '/')
  const resolvedPath = resolveContentLocalePath(requestedPath, contentI18nConfig)
  const requestedLocale = resolveRequestedLocale(
    payload.locale ?? resolvedPath.locale,
    contentI18nConfig,
  )
  const normalizedPath = resolvedPath.basePath
  const now = new Date().toISOString()

  const databaseName = getContentDatabaseName()
  const documentIds = buildLocaleDocumentIds(normalizedPath, contentI18nConfig)
  const { legacyMasterId, legacyLocaleId } = buildRootLegacyDocumentIds(
    normalizedPath,
    requestedLocale,
    contentI18nConfig.defaultLocale,
  )
  if (legacyMasterId && !documentIds.includes(legacyMasterId)) {
    documentIds.push(legacyMasterId)
  }
  if (legacyLocaleId && !documentIds.includes(legacyLocaleId)) {
    documentIds.push(legacyLocaleId)
  }
  const allDocsResponse = await getAllDocs(databaseName, {
    keys: documentIds,
    include_docs: true,
  })
  const rows = Array.isArray(allDocsResponse?.rows) ? allDocsResponse.rows : []
  const docsById = toRowsById(rows as Array<{ doc?: Record<string, any> }>)

  const defaultLocale = contentI18nConfig.defaultLocale
  const masterId = getLocaleDocumentId(normalizedPath, defaultLocale, contentI18nConfig)
  const localeId = getLocaleDocumentId(
    normalizedPath,
    requestedLocale,
    contentI18nConfig,
  )

  const masterExisting = docsById.get(masterId) ??
    (legacyMasterId ? docsById.get(legacyMasterId) : null) ??
    null
  const localeExisting = docsById.get(localeId) ??
    (legacyLocaleId ? docsById.get(legacyLocaleId) : null) ??
    null
  const effectiveMasterId = masterExisting?._id ?? masterId
  const effectiveLocaleId = localeExisting?._id ?? localeId

  if (options.isCreate) {
    if (requestedLocale === defaultLocale && masterExisting) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Page already exists',
      })
    }

    if (requestedLocale !== defaultLocale && !masterExisting) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Default locale page not found. Create it before adding translations.',
      })
    }

    if (requestedLocale !== defaultLocale && localeExisting) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Translation page already exists',
      })
    }
  } else if (!masterExisting) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Page not found',
    })
  }

  const docsToPersist = new Map<string, Record<string, any>>()
  const updatedAtByLocale: Record<string, string> = {}
  let fixedBodyPaths: string[] = []

  const currentMaster =
    masterExisting && isPlainObject(masterExisting)
      ? clonePageDocument(masterExisting)
      : null

  if (requestedLocale === defaultLocale) {
    const masterUpdated = sanitiseIncomingDocument(payload.document, {
      isCreate: !masterExisting,
      existing: masterExisting ?? undefined,
      documentId: effectiveMasterId,
    }) as unknown as Record<string, any>
    const masterDocument = clonePageDocument(masterUpdated)
    masterDocument.path = normalizedPath
    const existingMasterMeta = readContentDocumentLocalizationMeta(
      masterExisting,
      contentI18nConfig,
    )

    fixedBodyPaths = resolveEffectiveFixedBodyPaths(
      existingMasterMeta.fixedBodyPaths,
      getIncomingFixedBodyPaths(payload.document),
    )

    const mergedUpdatedAt = mergeUpdatedAtByLocale(existingMasterMeta.updatedAtByLocale)
    mergedUpdatedAt[defaultLocale] = now

    masterDocument.updatedAt = now
      ensureDocumentLocalizationMeta(masterDocument, {
        locale: defaultLocale,
        masterId: effectiveMasterId,
        basePath: normalizedPath,
        defaultLocale,
      touchedAt: now,
      fixedBodyPaths,
      mergedUpdatedAtByLocale: mergedUpdatedAt,
    })

    docsToPersist.set(masterDocument._id, masterDocument)

    const masterBodyValue = getBodyValue(masterDocument)
    for (const locale of contentI18nConfig.locales) {
      if (locale === defaultLocale) {
        continue
      }

      const translationId = getLocaleDocumentId(
        normalizedPath,
        locale,
        contentI18nConfig,
      )
      const translationExisting = docsById.get(translationId)
      if (!translationExisting) {
        continue
      }

      const translationDocument = clonePageDocument(translationExisting)
      const expectedLocalePath = buildLocalizedPath(
        normalizedPath,
        locale,
        contentI18nConfig,
      )
      const pathChanged = translationDocument.path !== expectedLocalePath
      if (pathChanged) {
        translationDocument.path = expectedLocalePath
      }
      const previousBody = getBodyValue(translationDocument)
      const nextBody = applyFixedBodyPaths(
        masterBodyValue,
        previousBody,
        fixedBodyPaths,
      )
      const bodyChanged = !valuesDeepEqual(previousBody, nextBody)

      if (bodyChanged) {
        setBodyValue(translationDocument, nextBody)
      }
      const shouldPersistTranslation = bodyChanged || pathChanged
      if (!shouldPersistTranslation) {
        continue
      }

      translationDocument.updatedAt = now
      mergedUpdatedAt[locale] = now

      ensureDocumentLocalizationMeta(translationDocument, {
        locale,
        masterId: effectiveMasterId,
        basePath: normalizedPath,
        defaultLocale,
        touchedAt:
          typeof mergedUpdatedAt[locale] === 'string'
            ? mergedUpdatedAt[locale]
            : now,
        fixedBodyPaths,
        mergedUpdatedAtByLocale: mergedUpdatedAt,
      })

      if (
        !translationExisting._rev ||
        !valuesDeepEqual(translationExisting, translationDocument)
      ) {
        docsToPersist.set(translationDocument._id, translationDocument)
      }
    }

    ensureDocumentLocalizationMeta(masterDocument, {
      locale: defaultLocale,
      masterId: effectiveMasterId,
      basePath: normalizedPath,
      defaultLocale,
      touchedAt: now,
      fixedBodyPaths,
      mergedUpdatedAtByLocale: mergedUpdatedAt,
    })
    docsToPersist.set(masterDocument._id, masterDocument)
    Object.assign(updatedAtByLocale, mergedUpdatedAt)
  } else {
    const masterBase = currentMaster as Record<string, any>
    const masterMeta = readContentDocumentLocalizationMeta(
      masterBase,
      contentI18nConfig,
    )
    fixedBodyPaths = resolveEffectiveFixedBodyPaths(
      masterMeta.fixedBodyPaths,
      getIncomingFixedBodyPaths(payload.document),
    )

    const localeBase = localeExisting ?? masterBase
    const localeUpdated = sanitiseIncomingDocument(payload.document, {
      isCreate: !localeExisting,
      existing: localeBase,
      documentId: effectiveLocaleId,
    }) as unknown as Record<string, any>
    const localeDocument = clonePageDocument(localeUpdated)
    localeDocument.path = buildLocalizedPath(
      normalizedPath,
      requestedLocale,
      contentI18nConfig,
    )
    localeDocument.updatedAt = now

    const mergedUpdatedAt = mergeUpdatedAtByLocale(masterMeta.updatedAtByLocale)
    if (!mergedUpdatedAt[defaultLocale]) {
      mergedUpdatedAt[defaultLocale] =
        masterBase.updatedAt ??
        masterBase.createdAt ??
        now
    }
    mergedUpdatedAt[requestedLocale] = now

    const baselineBody = getBodyValue(localeBase)
    const nextLocaleBody = getBodyValue(localeDocument)
    const changedFixedBodyPaths = collectChangedFixedBodyPaths(
      baselineBody,
      nextLocaleBody,
      fixedBodyPaths,
    )

    let activeMaster = clonePageDocument(masterBase)
    let activeMasterBody = getBodyValue(activeMaster)

    if (changedFixedBodyPaths.length > 0) {
      activeMasterBody = applyBodyPathsFromSource(
        activeMasterBody,
        nextLocaleBody,
        changedFixedBodyPaths,
      )
      setBodyValue(activeMaster, activeMasterBody)
      activeMaster.path = normalizedPath
      activeMaster.updatedAt = now
      mergedUpdatedAt[defaultLocale] = now
    }

    const localeBodyWithFixed = applyFixedBodyPaths(
      activeMasterBody,
      nextLocaleBody,
      fixedBodyPaths,
    )
    setBodyValue(localeDocument, localeBodyWithFixed)

    ensureDocumentLocalizationMeta(localeDocument, {
      locale: requestedLocale,
      masterId: effectiveMasterId,
      basePath: normalizedPath,
      defaultLocale,
      touchedAt: now,
      fixedBodyPaths,
      mergedUpdatedAtByLocale: mergedUpdatedAt,
    })
    docsToPersist.set(localeDocument._id, localeDocument)

    const masterBodyChanged = !valuesDeepEqual(
      getBodyValue(masterBase),
      activeMasterBody,
    )

    if (masterBodyChanged) {
      ensureDocumentLocalizationMeta(activeMaster, {
        locale: defaultLocale,
        masterId: effectiveMasterId,
        basePath: normalizedPath,
        defaultLocale,
        touchedAt: mergedUpdatedAt[defaultLocale] ?? now,
        fixedBodyPaths,
        mergedUpdatedAtByLocale: mergedUpdatedAt,
      })
      docsToPersist.set(activeMaster._id, activeMaster)
    }

    for (const locale of contentI18nConfig.locales) {
      if (locale === defaultLocale || locale === requestedLocale) {
        continue
      }

      const translationId = getLocaleDocumentId(
        normalizedPath,
        locale,
        contentI18nConfig,
      )
      const translationExisting = docsById.get(translationId)
      if (!translationExisting) {
        continue
      }

      const translationDocument = clonePageDocument(translationExisting)
      const expectedLocalePath = buildLocalizedPath(
        normalizedPath,
        locale,
        contentI18nConfig,
      )
      const pathChanged = translationDocument.path !== expectedLocalePath
      if (pathChanged) {
        translationDocument.path = expectedLocalePath
      }
      const previousBody = getBodyValue(translationDocument)
      const nextBody = applyFixedBodyPaths(
        activeMasterBody,
        previousBody,
        fixedBodyPaths,
      )
      const bodyChanged = !valuesDeepEqual(previousBody, nextBody)

      if (bodyChanged) {
        setBodyValue(translationDocument, nextBody)
      }
      const shouldPersistTranslation = bodyChanged || pathChanged
      if (!shouldPersistTranslation) {
        continue
      }

      translationDocument.updatedAt = now
      mergedUpdatedAt[locale] = now

      ensureDocumentLocalizationMeta(translationDocument, {
        locale,
        masterId: effectiveMasterId,
        basePath: normalizedPath,
        defaultLocale,
        touchedAt:
          typeof mergedUpdatedAt[locale] === 'string'
            ? mergedUpdatedAt[locale]
            : now,
        fixedBodyPaths,
        mergedUpdatedAtByLocale: mergedUpdatedAt,
      })

      if (
        !translationExisting._rev ||
        !valuesDeepEqual(translationExisting, translationDocument)
      ) {
        docsToPersist.set(translationDocument._id, translationDocument)
      }
    }

    Object.assign(updatedAtByLocale, mergedUpdatedAt)
  }

  const persistableDocuments = Array.from(docsToPersist.values()).map((document) =>
    toPersistableDocument(document),
  )
  await persistDocuments(databaseName, persistableDocuments)

  const docsByPersistedId = new Map(
    persistableDocuments.map((doc) => [doc._id as string, doc]),
  )
  const latestMaster =
    docsByPersistedId.get(effectiveMasterId) ??
    (currentMaster ? toPersistableDocument(currentMaster) : null)
  const latestLocale =
    requestedLocale === defaultLocale
      ? latestMaster
      : docsByPersistedId.get(effectiveLocaleId) ??
        (localeExisting ? toPersistableDocument(localeExisting) : null)

  const responseLocaleDocument = latestLocale && latestMaster
    ? (() => {
        const responseDoc = clonePageDocument(latestLocale)
        const mergedBody = buildLocalizedBodyForRead(
          getBodyValue(latestMaster),
          getBodyValue(latestLocale),
          fixedBodyPaths,
        )
        setBodyValue(responseDoc, mergedBody)
        return responseDoc
      })()
    : latestMaster

  if (!responseLocaleDocument) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to resolve saved localized page',
    })
  }

  await Promise.allSettled(
    persistableDocuments.map(async (document) => {
      try {
        await savePageHistory(document as any)
      } catch (error) {
        console.warn('[content] failed to store page history entry:', error)
      }
    }),
  )

  const missingLocalizedCount =
    requestedLocale === defaultLocale
      ? 0
      : countMissingLocalizedValues(
          getBodyValue(latestMaster as Record<string, any>),
          latestLocale ? getBodyValue(latestLocale) : undefined,
          fixedBodyPaths,
        )

  return {
    page: responseLocaleDocument,
    locale: requestedLocale,
    defaultLocale,
    updatedAtByLocale,
    hasLocaleDocument: requestedLocale !== defaultLocale && Boolean(latestLocale),
    missingLocalizedCount,
  }
}
