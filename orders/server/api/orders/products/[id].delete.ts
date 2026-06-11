import { createError, defineEventHandler, getRouterParam } from 'h3'
import { getDocument, putDocument } from '#database/utils/couchdb'
import { assertOrdersAdminSession } from '../../../utils/auth'
import { type OrdersProductDocument } from '../../../utils/catalog'
import { getOrdersDatabaseName } from '../../../utils/orders-database'

export default defineEventHandler(async (event) => {
  await assertOrdersAdminSession(event)

  const rawId = getRouterParam(event, 'id')
  const documentId = rawId ? decodeURIComponent(rawId) : ''

  if (!documentId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Product id is required.',
    })
  }

  const databaseName = getOrdersDatabaseName()
  const existing = await getDocument<OrdersProductDocument>(databaseName, documentId)

  if (!existing || existing.type !== 'orders_product') {
    throw createError({
      statusCode: 404,
      statusMessage: 'Product not found.',
    })
  }

  const archived: OrdersProductDocument = {
    ...existing,
    status: 'archived',
    updatedAt: new Date().toISOString(),
  }
  const result = await putDocument(databaseName, archived)

  return {
    success: true,
    product: {
      ...archived,
      _rev: result.rev,
    },
  }
})
