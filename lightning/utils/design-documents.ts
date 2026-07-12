import type { CouchDBDesignDocument } from '#database/utils/couchdb'

/**
 * Lightning layer design document for order/invoice management
 * Provides views for querying lightning orders/invoices efficiently
 */
export const lightningDesignDocument: CouchDBDesignDocument = {
  _id: '_design/lightning',
  language: 'javascript',
  views: {
    /**
     * Query invoices by their invoice ID
     * Key: invoiceId, Value: full document
     */
    by_invoice_id: {
      map: `function(doc) {
        if (doc.invoiceId && doc.type === 'lightning_invoice') {
          emit(doc.invoiceId, doc);
        }
      }`
    },
    invoice_links_by_invoice_id: {
      map: `function(doc) {
        if (doc.type === 'lightning_invoice_link' && doc.invoiceId) {
          emit(doc.invoiceId, doc);
        }
      }`
    },
    invoice_links_by_purpose: {
      map: `function(doc) {
        if (doc.type === 'lightning_invoice_link' && doc.purpose) {
          emit(doc.purpose, doc);
        }
      }`
    },

    /**
     * Query invoices by status
     * Key: status, Value: full document
     */
    by_status: {
      map: `function(doc) {
        var status = doc.status || (doc.payment && doc.payment.status) || (doc.invoiceData && doc.invoiceData.status);
        if (status && doc.type === 'lightning_invoice') {
          emit(status, doc);
        }
      }`
    },

    /**
     * Query invoices by provider
     * Key: provider, Value: full document
     */
    by_provider: {
      map: `function(doc) {
        var provider = doc.provider || (doc.invoiceData && doc.invoiceData.provider) || (doc.payment && doc.payment.provider);
        if (provider && doc.type === 'lightning_invoice') {
          emit(provider, doc);
        }
      }`
    },

    /**
     * Query invoices by creation timestamp
     * Key: createdAt, Value: full document
     */
    by_timestamp: {
      map: `function(doc) {
        var createdAt = doc.createdAt || doc.timestamp || (doc.payment && doc.payment.createdAt);
        if (createdAt && doc.type === 'lightning_invoice') {
          emit(createdAt, doc);
        }
      }`
    },

    /**
     * Query invoices by status and timestamp (compound key)
     * Key: [status, createdAt], Value: full document
     */
    by_status_and_timestamp: {
      map: `function(doc) {
        var status = doc.status || (doc.payment && doc.payment.status) || (doc.invoiceData && doc.invoiceData.status);
        var createdAt = doc.createdAt || doc.timestamp || (doc.payment && doc.payment.createdAt);
        if (status && createdAt && doc.type === 'lightning_invoice') {
          emit([status, createdAt], doc);
        }
      }`
    },

    /**
     * Query invoices by provider and status (compound key)
     * Key: [provider, status], Value: full document
     */
    by_provider_and_status: {
      map: `function(doc) {
        var provider = doc.provider || (doc.invoiceData && doc.invoiceData.provider) || (doc.payment && doc.payment.provider);
        var status = doc.status || (doc.payment && doc.payment.status) || (doc.invoiceData && doc.invoiceData.status);
        if (provider && status && doc.type === 'lightning_invoice') {
          emit([provider, status], doc);
        }
      }`
    },

    /**
     * Query invoices by amount range
     * Key: amount, Value: {invoiceId, amount, status}
     */
    by_amount: {
      map: `function(doc) {
        if (doc.amount && doc.type === 'lightning_invoice') {
          emit(doc.amount, {
            invoiceId: doc.invoiceId,
            amount: doc.amount,
            status: doc.status,
            currency: doc.currency
          });
        }
      }`
    },

    /**
     * Query invoices by expiration date
     * Key: expiresAt, Value: {invoiceId, status, expiresAt}
     */
    by_expiration: {
      map: `function(doc) {
        if (doc.expiresAt && doc.type === 'lightning_invoice') {
          emit(doc.expiresAt, {
            invoiceId: doc.invoiceId,
            status: doc.status,
            expiresAt: doc.expiresAt
          });
        }
      }`
    },

    /**
    * Query invoices by amount range
    * Key: amount, Value: {userName, email}
    */
    by_user: {
      map: `function(doc) {
        if (doc.userName && ((doc.type === 'lightning_invoice') || (doc.type === 'invoice'))) {
          emit(doc.userName, {
            email: doc.email
          });
        }
      }`
    },

    /**
     * Statistics view - count orders by status
     * Key: status, Value: 1 (for counting with reduce)
     */
    stats_by_status: {
      map: `function(doc) {
        var status = doc.status || (doc.payment && doc.payment.status) || (doc.invoiceData && doc.invoiceData.status);
        if (status && doc.type === 'lightning_invoice') {
          emit(status, 1);
        }
      }`,
      reduce: `function(keys, values, rereduce) {
        return sum(values);
      }`
    },

    /**
     * Statistics view - sum amounts by provider
     * Key: provider, Value: amount (for summing with reduce)
     */
    stats_by_provider: {
      map: `function(doc) {
        if (doc.provider && doc.amount && doc.type === 'lightning_invoice') {
          emit(doc.provider, doc.amount);
        }
      }`,
      reduce: `function(keys, values, rereduce) {
        return sum(values);
      }`
    }
  }
};
