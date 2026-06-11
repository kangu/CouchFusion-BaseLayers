import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { getDocument, putDocument } from '#database/utils/couchdb'
import { assertOrdersAdminSession } from '../../../utils/auth'
import {
  normalizeProductInput,
  slugifyProductName,
  type OrdersProductDocument,
  type ProductInput,
} from '../../../utils/catalog'
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

  const body = await readBody<ProductInput>(event)
  const requestedSlug = body?.slug ? slugifyProductName(body.slug) : existing.slug

  if (requestedSlug !== existing.slug) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Product slug cannot be changed after creation.',
    })
  }

  const product = normalizeProductInput(
    {
      ...body,
      slug: existing.slug,
      _rev: existing._rev,
    },
    existing,
  )
  const result = await putDocument(databaseName, product)

  return {
    success: true,
    product: {
      ...product,
      _rev: result.rev,
    },
  }
})
