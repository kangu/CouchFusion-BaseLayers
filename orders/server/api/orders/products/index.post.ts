import { createError, defineEventHandler, readBody } from 'h3'
import { getDocument, putDocument } from '#database/utils/couchdb'
import { assertOrdersAdminSession } from '../../../utils/auth'
import {
  normalizeProductInput,
  type OrdersProductDocument,
  type ProductInput,
} from '../../../utils/catalog'
import { getOrdersDatabaseName } from '../../../utils/orders-database'

export default defineEventHandler(async (event) => {
  await assertOrdersAdminSession(event)

  const body = await readBody<ProductInput>(event)
  const databaseName = getOrdersDatabaseName()
  const product = normalizeProductInput(body)
  const existing = await getDocument<OrdersProductDocument>(databaseName, product._id)

  if (existing) {
    throw createError({
      statusCode: 409,
      statusMessage: 'A product with this slug already exists.',
    })
  }

  const result = await putDocument(databaseName, product)

  return {
    success: true,
    product: {
      ...product,
      _rev: result.rev,
    },
  }
})
