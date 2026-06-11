import { createError } from 'h3'
import { getView } from '#database/utils/couchdb'
import {
  isOrdersProductDocument,
  type OrdersProductDocument,
} from './catalog'

export const resolveOrdersDatabaseName = (dbLoginPrefix: unknown): string => {
  if (typeof dbLoginPrefix !== 'string' || !dbLoginPrefix.trim()) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Server configuration error: dbLoginPrefix missing',
    })
  }

  return `${dbLoginPrefix}-orders`
}

export const getOrdersDatabaseName = (): string => {
  const runtimeConfig = useRuntimeConfig()
  return resolveOrdersDatabaseName(runtimeConfig.dbLoginPrefix)
}

export const listProductDocuments = async (
  databaseName = getOrdersDatabaseName(),
  status?: OrdersProductDocument['status'],
): Promise<OrdersProductDocument[]> => {
  const viewName = status ? 'products_by_status' : 'products_by_sort_order'
  const query = status
    ? {
        startkey: [status],
        endkey: [status, {}],
        include_docs: true,
      }
    : {
        include_docs: true,
      }

  const response = await getView(databaseName, 'orders', viewName, query)
  const products = (response?.rows ?? [])
    .map((row) => row.doc)
    .filter(isOrdersProductDocument)
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder
      }
      return left.name.localeCompare(right.name)
    })

  return products
}
