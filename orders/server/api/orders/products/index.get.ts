import { defineEventHandler } from 'h3'
import { assertOrdersAdminSession } from '../../../utils/auth'
import { listProductDocuments } from '../../../utils/orders-database'

export default defineEventHandler(async (event) => {
  await assertOrdersAdminSession(event)

  const products = await listProductDocuments()

  return {
    success: true,
    products,
    total: products.length,
  }
})
