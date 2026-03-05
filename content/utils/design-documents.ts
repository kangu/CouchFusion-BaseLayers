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
                if (typeof id === 'string' && id.indexOf('oldpage-') === 0) {
                    return;
                }

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
        ,
        history_by_path: {
            map: `function (doc) {
                if (!doc || typeof doc !== 'object') {
                    return;
                }

                var id = doc._id || '';
                if (typeof id !== 'string' || id.indexOf('oldpage-') !== 0) {
                    return;
                }

                var path = '';
                if (
                    doc.meta &&
                    typeof doc.meta === 'object' &&
                    doc.meta.contentI18n &&
                    typeof doc.meta.contentI18n === 'object' &&
                    typeof doc.meta.contentI18n.basePath === 'string'
                ) {
                    path = doc.meta.contentI18n.basePath;
                } else if (typeof doc.contentBasePath === 'string' && doc.contentBasePath) {
                    path = doc.contentBasePath;
                } else if (typeof doc.path === 'string' && doc.path) {
                    path = doc.path;
                } else {
                    path = id.substring('oldpage-'.length);
                }

                if (!path) {
                    return;
                }

                var locale = doc.contentLocale || 'en';
                if (typeof locale !== 'string' || !locale) {
                    locale = 'en';
                }

                var timestamp = doc.updatedAt || doc.updated_at || doc.createdAt || doc.created_at || doc.savedAt;
                if (!timestamp) {
                    timestamp = new Date().toISOString();
                }

                emit([path, locale, timestamp], {
                    id: id,
                    path: path,
                    locale: locale,
                    timestamp: timestamp,
                    title: doc.title || null
                });
            }`
        }
    }
}
