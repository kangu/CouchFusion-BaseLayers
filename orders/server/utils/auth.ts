import { createError, getHeader } from 'h3'
import { getSession } from '#database/utils/couchdb'

const extractAuthSessionCookie = (cookieHeader?: string | null): string | null => {
  if (!cookieHeader) {
    return null
  }

  for (const segment of cookieHeader.split(';')) {
    const [key, ...rest] = segment.trim().split('=')
    if (key === 'AuthSession') {
      return rest.join('=')
    }
  }

  return null
}

export const assertOrdersAdminSession = async (event: any) => {
  const sessionToken = extractAuthSessionCookie(getHeader(event, 'cookie'))

  if (!sessionToken) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not found',
    })
  }

  const session = await getSession({ authSessionCookie: sessionToken })

  if (!session?.userCtx?.roles?.includes('admin')) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not found',
    })
  }

  return session
}
