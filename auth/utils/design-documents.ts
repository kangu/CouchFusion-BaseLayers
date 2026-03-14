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
    by_nostr_npub: {
      map: `function(doc) {
        if (
          doc &&
          doc.type === 'user' &&
          doc.nostr &&
          typeof doc.nostr.npub === 'string' &&
          doc.nostr.npub
        ) {
          emit(doc.nostr.npub, null);
        }
      }`,
    },
    watchers_by_conference: {
      map: `function(doc) {
        if (
          !doc ||
          doc.type !== 'user' ||
          !doc.nostr ||
          typeof doc.nostr.npub !== 'string' ||
          !doc.nostr.npub ||
          !doc.conference_prefs ||
          !Array.isArray(doc.conference_prefs.watched)
        ) {
          return;
        }

        for (var index = 0; index < doc.conference_prefs.watched.length; index += 1) {
          var conferenceId = doc.conference_prefs.watched[index];
          if (typeof conferenceId === 'string' && conferenceId) {
            emit(conferenceId, {
              user_id: doc._id,
              username: doc.name,
              npub: doc.nostr.npub
            });
          }
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
