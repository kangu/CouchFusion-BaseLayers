import { defineEventHandler } from 'h3'
import { toPublicProduct } from '../../../utils/catalog'
import { listProductDocuments } from '../../../utils/orders-database'

export default defineEventHandler(async () => {
  const products = await listProductDocuments(undefined, 'active')

  return {
    success: true,
    products: products.map(toPublicProduct),
    total: products.length,
  }
})
