import { createHmac, timingSafeEqual } from 'node:crypto'
import {
  createError,
  getCookie,
  setCookie,
  getHeader,
  getRequestURL,
  type H3Event,
} from 'h3'
import { publicSettings } from '../options'
import {
  createSessionClient,
  createServiceClient,
  getBootstrapConfig,
  COUCHDB_URL,
} from './client'
import { getCouchDBSettings } from './settings'
import type { AuthUser } from '../shared/types'
import { createCsrfToken } from './csrf'
import { isWithinSessionAge } from './session-age'
function csrf(event: H3Event) {
  return createCsrfToken(
    getCookie(event, 'AuthSession') ?? 'anonymous',
    getBootstrapConfig().adminAuth,
  )
}
export function assertCookieMutation(event: H3Event) {
  const origin = getHeader(event, 'origin')
  if (origin) {
    try {
      if (new URL(origin).origin !== getRequestURL(event).origin)
        throw new Error()
    } catch {
      throw createError({
        statusCode: 403,
        statusMessage: 'Invalid request origin',
      })
    }
  }
  const expected = csrf(event),
    actual = getHeader(event, 'x-couchdb-csrf') ?? ''
  if (
    actual.length !== expected.length ||
    !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
  )
    throw createError({ statusCode: 403, statusMessage: 'Invalid CSRF token' })
}
export async function currentUser(event: H3Event): Promise<AuthUser | null> {
  if ('couchdbUser' in event.context) return event.context.couchdbUser
  const token = getCookie(event, 'AuthSession')
  if (!token) {
    event.context.couchdbUser = null
    return null
  }
  try {
    const response = await createSessionClient({}, token).request('/_session')
    if (response.status === 401 || response.status === 403) {
      event.context.couchdbUser = null
      return null
    }
    if (!response.ok) throw new Error()
    const session = await response.json(),
      ctx = session.userCtx
    const user =
      typeof ctx?.name === 'string'
        ? {
            name: ctx.name,
            roles: Array.isArray(ctx.roles)
              ? ctx.roles.filter((r: unknown) => typeof r === 'string')
              : [],
          }
        : null
    if (
      user &&
      !isWithinSessionAge(
        token,
        user.name,
        (await getCouchDBSettings(event)).auth.sessionMaxAgeSeconds,
      )
    ) {
      event.context.couchdbUser = null
      return null
    }
    event.context.couchdbUser = user
    return user
  } catch {
    throw createError({
      statusCode: 503,
      statusMessage: 'CouchDB session validation unavailable',
    })
  }
}
export async function requireUser(event: H3Event): Promise<AuthUser> {
  const user = await currentUser(event)
  if (!user)
    throw createError({
      statusCode: 401,
      statusMessage: 'Authentication required',
    })
  return user
}
export async function requireRoles(
  event: H3Event,
  roles: string[],
  mode: 'any' | 'all' = 'any',
) {
  const user = await requireUser(event)
  if (
    !roles.length ||
    !(mode === 'all'
      ? roles.every((r) => user.roles.includes(r))
      : roles.some((r) => user.roles.includes(r)))
  )
    throw createError({ statusCode: 403, statusMessage: 'Access denied' })
  return user
}
export async function requireAdmin(event: H3Event) {
  const settings = await getCouchDBSettings(event)
  if (!settings.features.admin)
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  return requireRoles(event, settings.admin.roles)
}
export async function sessionResponse(event: H3Event, user?: AuthUser | null) {
  const settings = await getCouchDBSettings(event)
  if (!settings.features.auth)
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  return {
    user: user === undefined ? await currentUser(event) : user,
    settings: publicSettings(settings),
    csrfToken: csrf(event),
  }
}
export function setSessionCookie(event: H3Event, value: string) {
  setCookie(event, 'AuthSession', value, {
    httpOnly: true,
    secure: getRequestURL(event).protocol === 'https:',
    sameSite: 'lax',
    path: '/',
  })
  event.context.couchdbUser = undefined
  delete event.context.couchdbUser
  // Subsequent CSRF responses must bind to the newly issued session, not the old request cookie.
  event.context.couchdbIssuedToken = value
}
export async function responseAfterLogin(
  event: H3Event,
  user: AuthUser,
  token: string,
) {
  setSessionCookie(event, token)
  const result = await sessionResponse(event, user)
  result.csrfToken = createCsrfToken(token, getBootstrapConfig().adminAuth)
  return result
}
export async function issueSignedSession(event: H3Event, username: string) {
  const settings = await getCouchDBSettings(event),
    client = createServiceClient()
  const policy = await client.json<Record<string, string>>(
    '/_node/_local/_config/chttpd_auth',
  )
  if (
    !settings.secrets.cookieSecret ||
    !policy.secret ||
    policy.secret !== settings.secrets.cookieSecret
  )
    throw createError({
      statusCode: 503,
      statusMessage: 'Passwordless signing policy is not configured',
    })
  const user = await client.json<any>(
    `/_users/${encodeURIComponent('org.couchdb.user:' + username)}`,
  )
  const timestamp = Math.floor(Date.now() / 1000)
    .toString(16)
    .toUpperCase()
  const data = `${username}:${timestamp}`
  const configuredAlgorithm = (policy.hash_algorithms ?? 'sha256')
    .split(',')[0]!
    .trim()
  const algorithm = configuredAlgorithm === 'sha' ? 'sha1' : configuredAlgorithm
  if (!['sha1', 'sha256'].includes(algorithm))
    throw createError({
      statusCode: 503,
      statusMessage: 'Unsupported CouchDB signing policy',
    })
  const signature = createHmac(algorithm, policy.secret + (user.salt ?? ''))
    .update(data)
    .digest()
  const token = Buffer.concat([Buffer.from(data + ':'), signature]).toString(
    'base64url',
  )
  const check = await createSessionClient(
    { url: COUCHDB_URL },
    token,
  ).json<any>('/_session')
  if (check.userCtx?.name !== username)
    throw createError({
      statusCode: 503,
      statusMessage: 'CouchDB rejected the issued session',
    })
  return responseAfterLogin(
    event,
    { name: username, roles: check.userCtx.roles ?? [] },
    token,
  )
}
