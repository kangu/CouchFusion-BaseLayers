import {
    deleteLocalDocument,
    getLocalDocument,
    putLocalDocument,
    type CouchDBDocument,
} from '#database/utils/couchdb'
import { clonePlain } from '#content/utils/page-documents'
import { normalizePagePath } from '#content/utils/page'
import { getContentDatabaseName } from './database'
import type { StoredContentPageDocument } from './content-documents'
import { CONTENT_META_I18N_KEY, normalizeLocaleCode } from '#content/utils/i18n'

const HISTORY_MAX_ENTRIES = 5
const HISTORY_INDEX_PREFIX = 'page-history-index-'

export interface PageHistoryRecord {
    id: string
    path: string
    locale: string
    timestamp: string
    title: string | null
    document: StoredContentPageDocument
}

interface PageHistoryIndexEntry {
    id: string
    timestamp: string
}

interface PageHistoryIndexDocument extends CouchDBDocument {
    type: 'page-history-index'
    path: string
    locale: string
    entries: PageHistoryIndexEntry[]
}

const toLocalId = (id: string) => id.startsWith('_local/') ? id : `_local/${id}`

const buildHistoryId = (documentId: string, timestamp: string) => toLocalId(`${documentId}-${timestamp}`)

const buildHistoryIndexId = (path: string, locale: string) =>
    toLocalId(`${HISTORY_INDEX_PREFIX}${encodeURIComponent(path)}-${locale}`)

const normalizeIndexEntries = (entries: unknown): PageHistoryIndexEntry[] => {
    if (!Array.isArray(entries)) {
        return []
    }

    return entries
        .map((entry) => {
            if (!entry || typeof entry !== 'object') {
                return null
            }
            const id = typeof (entry as any).id === 'string' ? toLocalId((entry as any).id) : ''
            const timestamp = typeof (entry as any).timestamp === 'string' ? (entry as any).timestamp : ''
            return id && timestamp ? { id, timestamp } : null
        })
        .filter((entry): entry is PageHistoryIndexEntry => Boolean(entry))
}

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

const loadHistoryIndex = async (
    databaseName: string,
    basePath: string,
    locale: string,
): Promise<PageHistoryIndexDocument> => {
    const existing = await getLocalDocument<PageHistoryIndexDocument>(
        databaseName,
        buildHistoryIndexId(basePath, locale),
    )

    if (existing) {
        return {
            ...existing,
            type: 'page-history-index',
            path: basePath,
            locale,
            entries: normalizeIndexEntries(existing.entries),
        }
    }

    return {
        _id: buildHistoryIndexId(basePath, locale),
        type: 'page-history-index',
        path: basePath,
        locale,
        entries: [],
    }
}

const deleteHistoryDocument = async (databaseName: string, documentId: string) => {
    const existing = await getLocalDocument(databaseName, documentId)
    if (!existing?._rev) {
        return
    }
    await deleteLocalDocument(databaseName, documentId, existing._rev)
}

export const savePageHistory = async (document: StoredContentPageDocument) => {
    const databaseName = getContentDatabaseName()
    const timestamp = new Date().toISOString()
    const historyDocument = cloneForHistory(document, timestamp)
    const locale = normalizeLocaleCode(historyDocument.contentLocale) ?? 'en'
    const basePath = normalizePagePath(historyDocument.contentBasePath || document.path || '/')

    await putLocalDocument(databaseName, historyDocument)

    const indexDocument = await loadHistoryIndex(databaseName, basePath, locale)
    const nextEntries = [
        { id: historyDocument._id, timestamp },
        ...indexDocument.entries.filter((entry) => entry.id !== historyDocument._id),
    ].sort((left, right) => right.timestamp.localeCompare(left.timestamp))

    const keptEntries = nextEntries.slice(0, HISTORY_MAX_ENTRIES)
    const surplusEntries = nextEntries.slice(HISTORY_MAX_ENTRIES)

    await putLocalDocument(databaseName, {
        ...indexDocument,
        entries: keptEntries,
    })

    for (const entry of surplusEntries) {
        await deleteHistoryDocument(databaseName, entry.id)
    }
}

export const fetchPageHistory = async (
    path: string,
    locale: string,
    limit = HISTORY_MAX_ENTRIES,
): Promise<PageHistoryRecord[]> => {
    const databaseName = getContentDatabaseName()
    const basePath = normalizePagePath(path)
    const normalizedLocale = normalizeLocaleCode(locale) ?? 'en'
    const indexDocument = await loadHistoryIndex(databaseName, basePath, normalizedLocale)
    const entries = normalizeIndexEntries(indexDocument.entries)
        .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
        .slice(0, limit)

    const documents = await Promise.all(
        entries.map(async (entry) => ({
            entry,
            doc: await getLocalDocument<StoredContentPageDocument>(databaseName, entry.id),
        })),
    )

    return documents
        .map(({ entry, doc }) => {
            doc = (doc ? clonePlain(doc) : null) as StoredContentPageDocument | null
            if (!doc) {
                return null
            }
            doc.path = doc.path || basePath
            const localeValue = normalizeLocaleCode(doc.contentLocale) ?? normalizedLocale
            const timestamp = doc.savedAt || doc.updatedAt || doc.updated_at || entry.timestamp || new Date().toISOString()
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
