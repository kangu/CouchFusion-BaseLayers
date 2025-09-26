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
        if (doc.invoiceId && doc.type === 'lightning_order') {
          emit(doc.invoiceId, doc);
        }
      }`
    },

    /**
     * Query invoices by status
     * Key: status, Value: full document
     */
    by_status: {
      map: `function(doc) {
        if (doc.status && doc.type === 'lightning_order') {
          emit(doc.status, doc);
        }
      }`
    },

    /**
     * Query invoices by provider
     * Key: provider, Value: full document  
     */
    by_provider: {
      map: `function(doc) {
        if (doc.provider && doc.type === 'lightning_order') {
          emit(doc.provider, doc);
        }
      }`
    },

    /**
     * Query invoices by creation timestamp
     * Key: createdAt, Value: full document
     */
    by_timestamp: {
      map: `function(doc) {
        if (doc.createdAt && doc.type === 'lightning_order') {
          emit(doc.createdAt, doc);
        }
      }`
    },

    /**
     * Query invoices by status and timestamp (compound key)
     * Key: [status, createdAt], Value: full document
     */
    by_status_and_timestamp: {
      map: `function(doc) {
        if (doc.status && doc.createdAt && doc.type === 'lightning_order') {
          emit([doc.status, doc.createdAt], doc);
        }
      }`
    },

    /**
     * Query invoices by provider and status (compound key)
     * Key: [provider, status], Value: full document
     */
    by_provider_and_status: {
      map: `function(doc) {
        if (doc.provider && doc.status && doc.type === 'lightning_order') {
          emit([doc.provider, doc.status], doc);
        }
      }`
    },

    /**
     * Query invoices by amount range
     * Key: amount, Value: {invoiceId, amount, status}
     */
    by_amount: {
      map: `function(doc) {
        if (doc.amount && doc.type === 'lightning_order') {
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
        if (doc.expiresAt && doc.type === 'lightning_order') {
          emit(doc.expiresAt, {
            invoiceId: doc.invoiceId,
            status: doc.status,
            expiresAt: doc.expiresAt
          });
        }
      }`
    },

    /**
     * Query Boltz swaps by swap ID
     * Key: swapId, Value: full document
     */
    by_swap_id: {
      map: `function(doc) {
        if (doc.swapId && doc.provider === 'boltz' && doc.type === 'lightning_order') {
          emit(doc.swapId, doc);
        }
      }`
    },

    /**
     * Statistics view - count orders by status
     * Key: status, Value: 1 (for counting with reduce)
     */
    stats_by_status: {
      map: `function(doc) {
        if (doc.status && doc.type === 'lightning_order') {
          emit(doc.status, 1);
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
        if (doc.provider && doc.amount && doc.type === 'lightning_order') {
          emit(doc.provider, doc.amount);
        }
      }`,
      reduce: `function(keys, values, rereduce) {
        return sum(values);
      }`
    }
  }
};