import { defineEventHandler } from 'h3'
import { getDocument } from '#database/utils/couchdb'
import { normalizeAdminLabelsDocument, type OrdersAdminLabelsDocument } from '../../../utils/admin-labels'
import { assertOrdersAdminSession } from '../../../utils/auth'
import { getOrdersDatabaseName } from '../../../utils/orders-database'

export default defineEventHandler(async (event) => {
  await assertOrdersAdminSession(event)

  const document = await getDocument<OrdersAdminLabelsDocument>(
    getOrdersDatabaseName(),
    'settings:orders-admin-labels',
  )
  const normalized = normalizeAdminLabelsDocument(document)

  return {
    success: true,
    labels: normalized.labels,
    document: document ?? normalized,
  }
})
