import { describe, expect, it } from 'vitest'
import {
  ADMIN_LABELS_DOCUMENT_ID,
  defaultAdminLabels,
  normalizeAdminLabelsDocument,
} from '../server/utils/admin-labels'

describe('orders admin label settings', () => {
  it('normalizes partial admin label documents with defaults', () => {
    const document = normalizeAdminLabelsDocument({
      labels: {
        productsTitle: 'Catalog produse',
        createProductButton: 'Creează produs',
      },
    })

    expect(document).toMatchObject({
      _id: ADMIN_LABELS_DOCUMENT_ID,
      type: 'orders_admin_labels',
      labels: {
        ...defaultAdminLabels,
        productsTitle: 'Catalog produse',
        createProductButton: 'Creează produs',
      },
    })
    expect(document.updatedAt).toBeTruthy()
  })
})
