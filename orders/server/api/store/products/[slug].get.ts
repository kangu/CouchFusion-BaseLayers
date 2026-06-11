import { createError, defineEventHandler, getRouterParam } from 'h3'
import { getDocument } from '#database/utils/couchdb'
import {
  isOrdersProductDocument,
  slugifyProductName,
  toPublicProduct,
  type OrdersProductDocument,
} from '../../../utils/catalog'
import { getOrdersDatabaseName } from '../../../utils/orders-database'

export default defineEventHandler(async (event) => {
  const slug = slugifyProductName(getRouterParam(event, 'slug'))
  const product = await getDocument<OrdersProductDocument>(
    getOrdersDatabaseName(),
    `product:${slug}`,
  )

  if (!isOrdersProductDocument(product) || product.status !== 'active') {
    throw createError({
      statusCode: 404,
      statusMessage: 'Product not found.',
    })
  }

  return {
    success: true,
    product: toPublicProduct(product),
  }
})
