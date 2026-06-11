import type { CouchDBDesignDocument } from '#database/utils/couchdb'

export const ordersDesignDocument: CouchDBDesignDocument = {
  _id: '_design/orders',
  language: 'javascript',
  views: {
    by_timestamp: {
      map: `function (doc) {
        if (doc.type === 'purchase' && (doc.timestamp || doc.createdAt)) {
          emit(doc.timestamp || doc.createdAt, doc);
        }
      }`
    },
    products_by_sort_order: {
      map: `function (doc) {
        if (doc.type === 'orders_product') {
          emit([doc.sortOrder || 0, doc.name || doc.slug || doc._id], null);
        }
      }`
    },
    products_by_status: {
      map: `function (doc) {
        if (doc.type === 'orders_product') {
          emit([doc.status || 'draft', doc.sortOrder || 0, doc.name || doc.slug || doc._id], null);
        }
      }`
    },
    products_by_slug: {
      map: `function (doc) {
        if (doc.type === 'orders_product' && doc.slug) {
          emit(doc.slug, null);
        }
      }`
    },
    orders_by_status: {
      map: `function (doc) {
        if (doc.type === 'purchase') {
          emit([doc.status || 'unknown', doc.timestamp || doc.createdAt || doc._id], null);
        }
      }`
    },
    orders_by_payment_method: {
      map: `function (doc) {
        if (doc.type === 'purchase' && doc.payment && doc.payment.method) {
          emit([doc.payment.method, doc.timestamp || doc.createdAt || doc._id], null);
        }
      }`
    }
  }
}
