import type { CouchDBDesignDocument } from "#database/utils/couchdb";

export const maintenanceDesignDocument: CouchDBDesignDocument = {
  _id: "_design/maintenance",
  language: "javascript",
  views: {
    clients_by_name: {
      map: `function (doc) {
        if (doc.type !== 'maintenance_client' || !doc.name) return;
        emit([doc.name.toLowerCase(), doc._id], {
          status: doc.status || 'active'
        });
      }`,
    },
    clients_by_contract_expiration_date: {
      map: `function (doc) {
        if (doc.type !== 'maintenance_client' || !doc.contractExpirationDate) return;
        emit([doc.contractExpirationDate, doc._id], {
          status: doc.status || 'active'
        });
      }`,
    },
    jobs_by_status_scheduled: {
      map: `function (doc) {
        if (doc.type !== 'maintenance_job' || !doc.status) return;
        emit([doc.status, doc.scheduledFor || '', doc._id], {
          clientId: doc.clientId || null
        });
      }`,
    },
    notifications_by_created_at: {
      map: `function (doc) {
        if (doc.type !== 'maintenance_notification' || !doc.createdAt) return;
        emit([doc.createdAt, doc._id], {
          status: doc.status || 'queued',
          channel: doc.channel || null
        });
      }`,
    },
    notifications_by_idempotency: {
      map: `function (doc) {
        if (doc.type !== 'maintenance_notification' || !doc.idempotencyKey) return;
        emit(doc.idempotencyKey, {
          status: doc.status || 'queued',
          recipient: doc.recipient || null
        });
      }`,
    },
  },
};
