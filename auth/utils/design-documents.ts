import type { CouchDBDesignDocument } from "#database/utils/couchdb";

/**
 * Auth layer design document for user management
 * Provides views for querying users by email
 */
export const authDesignDocument: CouchDBDesignDocument = {
  _id: "_design/auth",
  language: "javascript",
  views: {
    has_account: {
      map: `function(doc) {
        if (doc.email) {
          emit(doc.email, doc);
        }
      }`,
    },
    has_account_case_insensitive: {
      map: `function(doc) {
        if (doc.email) {
          emit(doc.email.toLowerCase(), doc);
        }
      }`,
    },
    referrals: {
      map: `function(doc) {
        if (doc.type === 'user' && typeof doc.referred_by === 'string' && doc.referred_by) {
          emit(doc.referred_by, 1);
        }
      }`,
      reduce: "_sum",
    },
  },
};
