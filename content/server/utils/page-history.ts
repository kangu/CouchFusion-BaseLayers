import { bulkDocs, getView, putDocument } from '#database/utils/couchdb'
import { clonePlain } from '#content/utils/page-documents'
import { normalizePagePath } from '#content/utils/page'
import { getContentDatabaseName } from './database'
import type { StoredContentPageDocument } from './content-documents'
import { CONTENT_META_I18N_KEY, normalizeLocaleCode } from '#content/utils/i18n'

const HISTORY_PREFIX = 'oldpage-'
const HISTORY_MAX_ENTRIES = 3
const HISTORY_DESIGN_DOC = 'content'
const HISTORY_VIEW = 'history_by_path'

export interface PageHistoryRecord {
    id: string
    path: string
    locale: string
    timestamp: string
    title: string | null
    document: StoredContentPageDocument
}

const buildHistoryId = (documentId: string, timestamp: string) => `${HISTORY_PREFIX}${documentId}-${timestamp}`

const cloneForHistory = (document: StoredContentPageDocument, timestamp: string): StoredContentPageDocument => {
    const cloned = clonePlain(document) as StoredContentPageDocument
    delete cloned._rev
    cloned._id = buildHistoryId(document._id, timestamp)
    cloned.savedAt = timestamp
    cloned.originalId = document._id
    cloned.type = 'page-history'
    const rawMeta = cloned.meta && typeof cloned.meta === 'object' ? cloned.meta : {}
    const rawI18n = rawMeta[CONTENT_META_I18N_KEY] && typeof rawMeta[CONTENT_META_I18N_KEY] === 'object'
        ? rawMeta[CONTENT_META_I18N_KEY]
        : {}
    const historyLocale = normalizeLocaleCode(rawI18n.locale) ?? normalizeLocaleCode(rawI18n.defaultLocale) ?? 'en'
    const basePath = typeof rawI18n.basePath === 'string' && rawI18n.basePath.trim()
        ? normalizePagePath(rawI18n.basePath)
        : normalizePagePath(cloned.path || '/')
    cloned.contentLocale = historyLocale
    cloned.contentBasePath = basePath
    return cloned
}

export const savePageHistory = async (document: StoredContentPageDocument) => {
    const databaseName = getContentDatabaseName()
    const timestamp = new Date().toISOString()
    const historyDocument = cloneForHistory(document, timestamp)
    const locale = normalizeLocaleCode(historyDocument.contentLocale) ?? 'en'
    const basePath = normalizePagePath(historyDocument.contentBasePath || document.path || '/')

    await putDocument(databaseName, historyDocument)

    const viewResponse = await getView(databaseName, HISTORY_DESIGN_DOC, HISTORY_VIEW, {
        startkey: [basePath, locale, '\ufff0'],
        endkey: [basePath, locale],
        include_docs: true,
        descending: true
    })

    const rows = viewResponse?.rows || []
    if (rows.length <= HISTORY_MAX_ENTRIES) {
        return
    }

    const surplus = rows.slice(HISTORY_MAX_ENTRIES)
        .map((row) => row.doc)
        .filter((doc): doc is { _id: string; _rev: string } => Boolean(doc?._id && doc?._rev))
        .map((doc) => ({
            _id: doc._id,
            _rev: doc._rev,
            _deleted: true
        }))

    if (surplus.length) {
        await bulkDocs(databaseName, surplus)
    }
}

export const fetchPageHistory = async (
    path: string,
    locale: string,
    limit = HISTORY_MAX_ENTRIES,
): Promise<PageHistoryRecord[]> => {
    const databaseName = getContentDatabaseName()
    const normalizedLocale = normalizeLocaleCode(locale) ?? 'en'
    const viewResponse = await getView(databaseName, HISTORY_DESIGN_DOC, HISTORY_VIEW, {
        startkey: [path, normalizedLocale, '\ufff0'],
        endkey: [path, normalizedLocale],
        include_docs: true,
        descending: true,
        limit
    })

    const rows = viewResponse?.rows || []

    return rows
        .map((row) => {
            const doc = (row.doc ? clonePlain(row.doc) : null) as StoredContentPageDocument | null
            if (!doc) {
                return null
            }
            doc.path = doc.path || path
            const localeValue = normalizeLocaleCode(doc.contentLocale || row.value?.locale) ?? normalizedLocale
            const timestamp = doc.savedAt || doc.updatedAt || doc.updated_at || row.value?.timestamp || new Date().toISOString()
            return {
                id: doc._id,
                path: doc.path,
                locale: localeValue,
                timestamp,
                title: doc.title ?? null,
                document: doc
            }
        })
        .filter((entry): entry is PageHistoryRecord => Boolean(entry && entry.path))
}
