import { createError, defineEventHandler, readBody } from 'h3'
import { getAllDocs, putDocument } from '#database/utils/couchdb'
import { normalizePagePath, pageIdFromPath } from '#content/utils/page'
import { normalizePublicationState, normalizeSeoImage } from '#content/utils/page-documents'
import { buildLocalizedPath, resolveContentLocalePath } from '#content/utils/i18n'
import { requireContentEditorSession } from '../../../utils/auth'
import { getContentDatabaseName } from '../../../utils/database'
import {
  getLocaleDocumentId,
  readContentDocumentLocalizationMeta,
  toPageDocumentRecord,
} from '../../../utils/content-i18n'
import { getEffectiveContentI18nConfig } from '../../../utils/content-i18n-settings'

const VALID_PUBLICATION_STATES = new Set(['published', 'draft'])

const buildRootLegacyDocumentId = (normalizedPath: string): string | null => {
  return normalizedPath === '/' ? 'page-/' : null
}

const toResponseEntry = (
  document: Record<string, any>,
  path: string,
  localization: {
    locale: string
    defaultLocale: string
    masterId: string
    hasLocaleDocument: boolean
    updatedAtByLocale: Record<string, string>
    missingLocalizedCount: number
  },
) => {
  const normalizedPath = normalizePagePath(path)
  const publicationState = normalizePublicationState(document.publicationState)
  const responseDocument = {
    ...document,
    publicationState,
  }

  return {
    id: document._id || pageIdFromPath(normalizedPath),
    path: normalizedPath,
    title: document.title ?? null,
    seoTitle: document.seoTitle ?? document.seo?.title ?? null,
    seoDescription: document.seoDescription ?? document.seo?.description ?? null,
    seoImage: normalizeSeoImage(document.seo?.image),
    publicationState,
    meta: document.meta ?? document.metadata ?? {},
    updatedAt: document.updatedAt ?? document.updated_at ?? null,
    doc: responseDocument,
    localization,
  }
}

export default defineEventHandler(async (event) => {
  await requireContentEditorSession(event)

  try {
    const body = await readBody<{ path?: unknown; publicationState?: unknown; locale?: unknown }>(event)

    if (!body || typeof body.path !== 'string' || !body.path.trim()) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Path is required',
      })
    }

    if (typeof body.publicationState !== 'string' || !VALID_PUBLICATION_STATES.has(body.publicationState)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid publication state',
      })
    }

    const { effective: contentI18nConfig } = await getEffectiveContentI18nConfig()
    const requestedPath = normalizePagePath(body.path)
    const resolvedPath = resolveContentLocalePath(requestedPath, contentI18nConfig)
    const normalizedPath = resolvedPath.basePath
    const defaultLocale = contentI18nConfig.defaultLocale
    const masterId = getLocaleDocumentId(normalizedPath, defaultLocale, contentI18nConfig)
    const legacyMasterId = buildRootLegacyDocumentId(normalizedPath)
    const keys = legacyMasterId && legacyMasterId !== masterId
      ? [masterId, legacyMasterId]
      : [masterId]

    const databaseName = getContentDatabaseName()
    const allDocsResponse = await getAllDocs(databaseName, {
      keys,
      include_docs: true,
    })
    const rows = Array.isArray(allDocsResponse?.rows) ? allDocsResponse.rows : []
    const masterDocument = rows
      .map((row) => toPageDocumentRecord(row.doc))
      .find((document): document is Record<string, any> => Boolean(document?._id && document?._rev))

    if (!masterDocument) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Page not found',
      })
    }

    const now = new Date().toISOString()
    const updatedDocument = {
      ...masterDocument,
      path: normalizedPath,
      publicationState: body.publicationState,
      updatedAt: now,
      type: 'page',
    }

    const response = await putDocument(databaseName, updatedDocument)
    if (response.rev) {
      updatedDocument._rev = response.rev
    }

    const localizationMeta = readContentDocumentLocalizationMeta(updatedDocument, contentI18nConfig)
    const updatedAtByLocale = {
      ...localizationMeta.updatedAtByLocale,
      [defaultLocale]: now,
    }

    return {
      success: true,
      id: updatedDocument._id,
      rev: updatedDocument._rev,
      page: toResponseEntry(updatedDocument, buildLocalizedPath(normalizedPath, defaultLocale, contentI18nConfig), {
        locale: defaultLocale,
        defaultLocale,
        masterId: localizationMeta.masterId,
        hasLocaleDocument: false,
        updatedAtByLocale,
        missingLocalizedCount: 0,
      }),
    }
  } catch (error: any) {
    if (error?.statusCode) {
      throw error
    }

    console.error('Content publication state PATCH error:', error)

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update publication state',
    })
  }
})
