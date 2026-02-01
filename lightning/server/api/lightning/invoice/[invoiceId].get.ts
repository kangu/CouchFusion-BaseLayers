import { defineEventHandler, getRouterParam, createError } from 'h3'
import { getDocument } from '#database/utils/couchdb'
import { useRuntimeConfig } from '#imports'

export default defineEventHandler(async (event) => {
  const invoiceId = getRouterParam(event, 'invoiceId')
  const runtimeConfig = useRuntimeConfig()

  if (!invoiceId) {
    throw createError({ statusCode: 400, statusMessage: 'Invoice ID is required' })
  }

  if (!runtimeConfig.dbLoginPrefix) {
    throw createError({ statusCode: 500, statusMessage: 'dbLoginPrefix missing' })
  }

  const databaseName = `${runtimeConfig.dbLoginPrefix}-orders`
  const invoiceDocId = invoiceId.startsWith('invoice-') ? invoiceId : `invoice-${invoiceId}`

  try {
    const doc = await getDocument<any>(databaseName, invoiceDocId)

    if (!doc) {
      throw createError({ statusCode: 404, statusMessage: 'Invoice document not found' })
    }

    const status = doc.invoiceData?.status || doc.status || 'pending'

    return {
      success: true,
      status,
      invoiceDocId,
      expiresAt: doc.invoiceData?.expiresAt || doc.expiresAt || null
    }
  } catch (err: any) {
    if (err?.statusCode) throw err
    throw createError({ statusCode: 500, statusMessage: err?.message || 'Failed to fetch invoice doc' })
  }
})
