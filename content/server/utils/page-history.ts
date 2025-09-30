import { bulkDocs, getView, putDocument } from '#database/utils/couchdb'
import { clonePlain } from '#content/utils/page-documents'
import { getContentDatabaseName } from './database'
import type { StoredContentPageDocument } from './content-documents'

const HISTORY_PREFIX = 'oldpage-'
const HISTORY_MAX_ENTRIES = 3
const HISTORY_DESIGN_DOC = 'content'
const HISTORY_VIEW = 'history_by_path'

export interface PageHistoryRecord {
    id: string
    path: string
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
    return cloned
}

export const savePageHistory = async (document: StoredContentPageDocument) => {
    const databaseName = getContentDatabaseName()
    const timestamp = new Date().toISOString()
    const historyDocument = cloneForHistory(document, timestamp)

    await putDocument(databaseName, historyDocument)

    const viewResponse = await getView(databaseName, HISTORY_DESIGN_DOC, HISTORY_VIEW, {
        startkey: [document.path, '\ufff0'],
        endkey: [document.path],
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

export const fetchPageHistory = async (path: string, limit = HISTORY_MAX_ENTRIES): Promise<PageHistoryRecord[]> => {
    const databaseName = getContentDatabaseName()
    const viewResponse = await getView(databaseName, HISTORY_DESIGN_DOC, HISTORY_VIEW, {
        startkey: [path, '\ufff0'],
        endkey: [path],
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
            const timestamp = doc.savedAt || doc.updatedAt || doc.updated_at || row.value?.timestamp || new Date().toISOString()
            return {
                id: doc._id,
                path: doc.path,
                timestamp,
                title: doc.title ?? null,
                document: doc
            }
        })
        .filter((entry): entry is PageHistoryRecord => Boolean(entry && entry.path))
}
