import { createHmac, timingSafeEqual } from 'node:crypto'
import {
  createError,
  deleteCookie,
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
import {
  REMEMBER_COOKIE,
  createRememberToken,
  readRememberToken,
  verifyRememberToken,
} from './remember'

const SESSION_COOKIE = 'AuthSession'
type NativePolicy = Record<string, string>

const cookieOptions = (event: H3Event, maxAge?: number) => ({
  httpOnly: true,
  secure: getRequestURL(event).protocol === 'https:',
  sameSite: 'lax' as const,
  path: '/',
  ...(maxAge ? { maxAge } : {}),
})

/**
 * CSRF tokens bind to the remembered login when there is one: it stays the same for its whole life, while the
 * native AuthSession is renewed by CouchDB every few minutes. Without a remembered login they bind to AuthSession.
 */
function csrfSubject(event: H3Event): string {
  return (
    event.context.couchdbCsrfSubject ??
    getCookie(event, REMEMBER_COOKIE) ??
    getCookie(event, SESSION_COOKIE) ??
    'anonymous'
  )
}
function csrf(event: H3Event) {
  return createCsrfToken(csrfSubject(event), getBootstrapConfig().adminAuth)
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

// ---------- native CouchDB session signing (read-only use of the server's policy) ----------
const nativePolicy = () =>
  createServiceClient().json<NativePolicy>('/_node/_local/_config/chttpd_auth')
async function userDoc(username: string): Promise<{ salt?: string } | null> {
  const response = await createServiceClient().request(
    `/_users/${encodeURIComponent('org.couchdb.user:' + username)}`,
  )
  if (response.status === 404) return null
  if (!response.ok) throw new Error('[couchdb] user lookup failed')
  return response.json()
}
/** Signs an AuthSession exactly as CouchDB does: HMAC(secret + user salt, "user:HEXTIME"). */
function signNativeSession(policy: NativePolicy, username: string, salt: string) {
  const timestamp = Math.floor(Date.now() / 1000)
    .toString(16)
    .toUpperCase()
  const data = `${username}:${timestamp}`
  const configured = (policy.hash_algorithms ?? 'sha256').split(',')[0]!.trim()
  const algorithm = configured === 'sha' ? 'sha1' : configured
  if (!['sha1', 'sha256'].includes(algorithm))
    throw createError({
      statusCode: 503,
      statusMessage: 'Unsupported CouchDB signing policy',
    })
  const signature = createHmac(algorithm, policy.secret + salt)
    .update(data)
    .digest()
  return Buffer.concat([Buffer.from(data + ':'), signature]).toString(
    'base64url',
  )
}
/** A fresh native session for a user, confirmed by CouchDB itself; null when CouchDB rejects it. */
async function mintNativeSession(
  policy: NativePolicy,
  username: string,
  salt: string,
): Promise<{ token: string; roles: string[] } | null> {
  const token = signNativeSession(policy, username, salt)
  const check = await createSessionClient({ url: COUCHDB_URL }, token).json<any>(
    '/_session',
  )
  if (check.userCtx?.name !== username) return null
  return {
    token,
    roles: Array.isArray(check.userCtx.roles)
      ? check.userCtx.roles.filter((r: unknown) => typeof r === 'string')
      : [],
  }
}
const renewedToken = (response: Response) =>
  /AuthSession=([^;]+)/.exec(response.headers.get('set-cookie') ?? '')?.[1]

/** Ends the browser's sign-in: the native session and the remembered login. */
export function clearSessionCookies(event: H3Event) {
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
  deleteCookie(event, REMEMBER_COOKIE, { path: '/' })
  event.context.couchdbCsrfSubject = 'anonymous'
}

/** Restores a signed-in user from the remembered login once the short native session has lapsed. */
async function restoreRemembered(
  event: H3Event,
  remember: string,
  ttl: number,
): Promise<AuthUser | null> {
  const claim = readRememberToken(remember)
  if (!claim) {
    clearSessionCookies(event)
    return null
  }
  const [policy, doc] = await Promise.all([nativePolicy(), userDoc(claim.u)])
  const valid =
    policy.secret &&
    doc?.salt &&
    verifyRememberToken(remember, { serverSecret: policy.secret, salt: doc.salt })
  const minted = valid ? await mintNativeSession(policy, claim.u, doc!.salt!) : null
  if (!minted) {
    clearSessionCookies(event)
    return null
  }
  setSessionCookie(event, minted.token, ttl)
  return { name: claim.u, roles: minted.roles }
}

export async function currentUser(event: H3Event): Promise<AuthUser | null> {
  if ('couchdbUser' in event.context) return event.context.couchdbUser
  const token = getCookie(event, SESSION_COOKIE)
  const settings = await getCouchDBSettings(event)
  const ttl = settings.auth.rememberSeconds
  const remember = ttl > 0 ? getCookie(event, REMEMBER_COOKIE) : undefined
  if (!token && !remember) {
    event.context.couchdbUser = null
    return null
  }
  let user: AuthUser | null = null
  try {
    if (token) {
      const response = await createSessionClient({}, token).request('/_session')
      if (response.ok) {
        const ctx = (await response.json()).userCtx
        user =
          typeof ctx?.name === 'string'
            ? {
                name: ctx.name,
                roles: Array.isArray(ctx.roles)
                  ? ctx.roles.filter((r: unknown) => typeof r === 'string')
                  : [],
              }
            : null
        if (user && remember) {
          // CouchDB renews an active session; pass the renewal on so the browser keeps a live cookie.
          const renewed = renewedToken(response)
          if (renewed && renewed !== token) setSessionCookie(event, renewed, ttl)
        } else if (
          user &&
          !isWithinSessionAge(token, user.name, settings.auth.sessionMaxAgeSeconds)
        )
          user = null
      } else if (response.status !== 401 && response.status !== 403)
        throw new Error()
    }
    if (!user && remember) user = await restoreRemembered(event, remember, ttl)
  } catch (cause) {
    if ((cause as { statusCode?: number })?.statusCode === 503) throw cause
    throw createError({
      statusCode: 503,
      statusMessage: 'CouchDB session validation unavailable',
    })
  }
  event.context.couchdbUser = user
  return user
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
  const resolved = user === undefined ? await currentUser(event) : user
  return {
    user: resolved,
    settings: publicSettings(settings),
    csrfToken: csrf(event),
  }
}
/** Sets the native session cookie; with a remembered login it outlives the browser session. */
export function setSessionCookie(event: H3Event, value: string, maxAge?: number) {
  setCookie(event, SESSION_COOKIE, value, cookieOptions(event, maxAge))
  event.context.couchdbUser = undefined
  delete event.context.couchdbUser
  event.context.couchdbIssuedToken = value
}
export async function responseAfterLogin(
  event: H3Event,
  user: AuthUser,
  token: string,
) {
  const settings = await getCouchDBSettings(event)
  const ttl = settings.auth.rememberSeconds
  let remember: string | null = null
  if (ttl > 0) {
    try {
      const [policy, doc] = await Promise.all([nativePolicy(), userDoc(user.name)])
      // Server admins defined only in CouchDB's config have no _users salt; they keep the plain native session.
      if (policy.secret && doc?.salt)
        remember = createRememberToken({
          serverSecret: policy.secret,
          salt: doc.salt,
          username: user.name,
          ttlSeconds: ttl,
        })
    } catch {
      remember = null
    }
  }
  setSessionCookie(event, token, remember ? ttl : undefined)
  if (remember) setCookie(event, REMEMBER_COOKIE, remember, cookieOptions(event, ttl))
  else deleteCookie(event, REMEMBER_COOKIE, { path: '/' })
  // Subsequent CSRF tokens bind to the login just issued, not to the request's old cookies.
  event.context.couchdbCsrfSubject = remember ?? token
  const result = await sessionResponse(event, user)
  result.csrfToken = createCsrfToken(
    event.context.couchdbCsrfSubject,
    getBootstrapConfig().adminAuth,
  )
  return result
}
export async function issueSignedSession(event: H3Event, username: string) {
  const settings = await getCouchDBSettings(event),
    policy = await nativePolicy()
  if (
    !settings.secrets.cookieSecret ||
    !policy.secret ||
    policy.secret !== settings.secrets.cookieSecret
  )
    throw createError({
      statusCode: 503,
      statusMessage: 'Passwordless signing policy is not configured',
    })
  const user = await createServiceClient().json<any>(
    `/_users/${encodeURIComponent('org.couchdb.user:' + username)}`,
  )
  const minted = await mintNativeSession(policy, username, user.salt ?? '')
  if (!minted)
    throw createError({
      statusCode: 503,
      statusMessage: 'CouchDB rejected the issued session',
    })
  return responseAfterLogin(event, { name: username, roles: minted.roles }, minted.token)
}
