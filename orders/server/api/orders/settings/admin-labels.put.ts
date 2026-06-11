import { defineEventHandler, readBody } from 'h3'
import { getDocument, putDocument } from '#database/utils/couchdb'
import { normalizeAdminLabelsDocument, type OrdersAdminLabelsDocument } from '../../../utils/admin-labels'
import { assertOrdersAdminSession } from '../../../utils/auth'
import { getOrdersDatabaseName } from '../../../utils/orders-database'

export default defineEventHandler(async (event) => {
  await assertOrdersAdminSession(event)

  const databaseName = getOrdersDatabaseName()
  const body = await readBody(event)
  const existing = await getDocument<OrdersAdminLabelsDocument>(
    databaseName,
    'settings:orders-admin-labels',
  )
  const document = normalizeAdminLabelsDocument(body, existing)
  const response = await putDocument(databaseName, document)

  return {
    success: true,
    labels: document.labels,
    document: {
      ...document,
      _rev: response.rev,
    },
  }
})
