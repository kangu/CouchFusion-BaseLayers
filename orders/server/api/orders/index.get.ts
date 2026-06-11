import { defineEventHandler, createError } from 'h3'
import { getView } from '#database/utils/couchdb'
import { assertOrdersAdminSession } from '../../utils/auth'
import { getOrdersDatabaseName } from '../../utils/orders-database'

export default defineEventHandler(async (event) => {
  await assertOrdersAdminSession(event)
  const ordersDatabaseName = getOrdersDatabaseName()

  try {
    const view = await getView(ordersDatabaseName, 'orders', 'by_timestamp', {
      descending: true,
      include_docs: true
    })

    const orders = (view?.rows || [])
      .map((row) => row.doc)
      .filter((doc): doc is Record<string, any> => Boolean(doc && doc.type === 'purchase'))

    return {
      success: true,
      orders,
      total: orders.length
    }
  } catch (error: any) {
    console.error('Failed to load orders:', error)
    throw createError({
      statusCode: error?.statusCode || 500,
      statusMessage: error?.statusMessage || error?.message || 'Failed to load orders'
    })
  }
})
