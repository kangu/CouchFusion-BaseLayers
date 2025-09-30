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
    }
  }
}
