import { randomUUID } from 'node:crypto'
import { createError, defineEventHandler, readBody } from 'h3'
import { bulkDocs } from '#database/utils/couchdb'
import { buildCashOnDeliveryPurchase } from '../../utils/catalog'
import { getOrdersDatabaseName, listProductDocuments } from '../../utils/orders-database'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    items?: Array<{ productId?: unknown; slug?: unknown; quantity?: unknown }>
    customer?: {
      name?: unknown
      phone?: unknown
      email?: unknown
    }
    deliveryAddress?: {
      addressLine1?: unknown
      addressLine2?: unknown
      city?: unknown
      county?: unknown
      postalCode?: unknown
      notes?: unknown
    }
  }>(event)

  if (!body || !Array.isArray(body.items)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid checkout payload.',
    })
  }

  const databaseName = getOrdersDatabaseName()
  const products = await listProductDocuments(databaseName, 'active')

  try {
    const result = buildCashOnDeliveryPurchase({
      products,
      items: body.items,
      customer: body.customer ?? {},
      deliveryAddress: body.deliveryAddress ?? {},
      idSuffix: randomUUID(),
    })

    await bulkDocs(databaseName, [
      result.purchase,
      ...result.updatedProducts,
    ])

    return {
      success: true,
      order: result.purchase,
    }
  } catch (error: any) {
    throw createError({
      statusCode: 400,
      statusMessage: error?.message || 'Unable to create cash-on-delivery order.',
    })
  }
})
