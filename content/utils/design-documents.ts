import type { CouchDBDesignDocument } from '#database/utils/couchdb'

/**
 * Content layer design document for querying pages by URL path.
 * Emits documents keyed by their public path so view queries can fetch by slug
 * or enumerate all pages.
 */
export const contentDesignDocument: CouchDBDesignDocument = {
    _id: '_design/content',
    language: 'javascript',
    views: {
        by_path: {
            map: `function (doc) {
                if (!doc || typeof doc !== 'object') {
                    return;
                }

                var id = doc._id || '';
                var isPageDoc = typeof id === 'string' && id.indexOf('page-') === 0;

                if (!isPageDoc && typeof doc.path !== 'string') {
                    return;
                }

                var path = typeof doc.path === 'string' && doc.path.length > 0
                    ? doc.path
                    : id.substring('page-'.length);

                if (!path || typeof path !== 'string') {
                    return;
                }

                emit(path, {
                    id: id,
                    title: doc.title || null,
                    updatedAt: doc.updatedAt || doc.updated_at || null
                });
            }`
        }
    }
}
