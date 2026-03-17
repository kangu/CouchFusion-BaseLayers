import { defineEventHandler, getQuery, createError } from 'h3'
import { normalizePagePath } from '#content/utils/page'
import { requireAdminSession } from '../../utils/auth'
import { getContentDatabaseName } from '../../utils/database'
import { bulkDocs, getAllDocs, deleteDocument } from '#database/utils/couchdb'
import {
  buildLocaleDocumentIds,
  resolveRuntimeContentI18nConfig,
  resolveRequestedLocale,
  toPageDocumentRecord,
} from '../../utils/content-i18n'

export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  try {
    const query = getQuery<{ path?: string; locale?: string }>(event)
    const path = query.path

    if (!path) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Path query parameter is required.',
      })
    }

    const normalizedPath = normalizePagePath(path)
    const contentI18nConfig = resolveRuntimeContentI18nConfig()
    const requestedLocale = resolveRequestedLocale(query.locale, contentI18nConfig)
    const databaseName = getContentDatabaseName()

    const documentIds = buildLocaleDocumentIds(normalizedPath, contentI18nConfig)
    const allDocsResponse = await getAllDocs(databaseName, {
      keys: documentIds,
      include_docs: true,
    })
    const rows = Array.isArray(allDocsResponse?.rows) ? allDocsResponse.rows : []
    const existingDocuments = rows
      .map((row) => toPageDocumentRecord(row.doc))
      .filter((doc): doc is Record<string, any> => Boolean(doc?._id && doc?._rev))

    if (!existingDocuments.length) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Page not found.',
      })
    }

    if (existingDocuments.length === 1) {
      const [single] = existingDocuments
      const response = await deleteDocument(databaseName, single._id, single._rev)
      return {
        success: true,
        id: response.id,
        rev: response.rev,
      }
    }

    const deletionPayload = existingDocuments.map((doc) => ({
      _id: doc._id,
      _rev: doc._rev,
      _deleted: true,
    }))

    const response = await bulkDocs(databaseName, deletionPayload)
    const failed = response.filter((entry) => !entry.ok)

    if (failed.length > 0) {
      const first = failed[0]
      throw createError({
        statusCode: 409,
        statusMessage: first.reason || first.error || 'Failed to delete page documents.',
      })
    }

    return {
      success: true,
      locale: requestedLocale,
      deleted: response
        .filter((entry) => entry.ok)
        .map((entry) => ({ id: entry.id, rev: entry.rev })),
    }
  } catch (error: any) {
    if (error?.statusCode) {
      throw error
    }

    console.error('Content pages DELETE error:', error)

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to delete page.',
    })
  }
})
