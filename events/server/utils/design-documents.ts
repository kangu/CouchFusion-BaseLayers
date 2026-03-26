import type { CouchDBDesignDocument } from "#database/utils/couchdb";

export const conferencesDesignDocument: CouchDBDesignDocument = {
  _id: "_design/conferences",
  language: "javascript",
  views: {
    by_start_date: {
      map: `function (doc) {
        if (doc.type !== 'conference') return;
        emit([doc.year || 0, doc.startDateIso, doc.slug || doc._id], {
          status: doc.status || '',
          continent: doc.continent || ''
        });
      }`,
    },
    by_slug: {
      map: `function (doc) {
        if (doc.type !== 'conference' || !doc.slug || !doc.websiteUrl) return;
        emit(doc.slug, {
          url: doc.websiteUrl
        });
      }`,
    },
    by_status: {
      map: `function (doc) {
        if (doc.type !== 'conference' || !doc.status) return;
        emit(doc.status, {
          year: doc.year || 0,
          startDateIso: doc.startDateIso || null
        });
      }`,
    },
    by_year: {
      map: `function (doc) {
        if (doc.type !== 'conference' || !doc.year) return;
        emit(doc.year, {
          status: doc.status || '',
          startDateIso: doc.startDateIso || null
        });
      }`,
    },
  },
};
