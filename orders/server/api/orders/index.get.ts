import { defineEventHandler, createError, getHeader } from 'h3'
import { getSession, getView } from '#database/utils/couchdb'

const extractAuthSessionCookie = (cookieHeader?: string | null) => {
  if (!cookieHeader) {
    return null
  }

  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim()
    if (trimmed.startsWith('AuthSession=')) {
      return trimmed.substring('AuthSession='.length)
    }
  }

  return null
}

export default defineEventHandler(async (event) => {
  const cookieHeader = getHeader(event, 'cookie')
  const sessionCookie = extractAuthSessionCookie(cookieHeader)

  if (!sessionCookie) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const session = await getSession({ authSessionCookie: sessionCookie })

  if (!session?.userCtx?.roles?.includes('admin')) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const runtimeConfig = useRuntimeConfig()
  const dbLoginPrefix = runtimeConfig.dbLoginPrefix

  if (!dbLoginPrefix) {
    throw createError({ statusCode: 500, statusMessage: 'Server configuration error: dbLoginPrefix missing' })
  }

  const ordersDatabaseName = `${dbLoginPrefix}-orders`

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
