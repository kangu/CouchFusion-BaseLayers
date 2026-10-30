import { createHmac, timingSafeEqual } from 'node:crypto'

/** HttpOnly cookie that keeps a person signed in across short native CouchDB sessions. */
export const REMEMBER_COOKIE = 'couchdb_remember'

export interface RememberPayload {
  /** username */
  u: string
  /** issued at, seconds */
  iat: number
  /** expires at, seconds */
  exp: number
}

// The key derives from CouchDB's own signing secret, so rotating that secret ends every remembered login.
const key = (serverSecret: string) =>
  createHmac('sha256', serverSecret).update('core:remember:v1').digest()

// The user's password salt is part of the MAC, so changing the password ends every remembered login for that user.
const mac = (serverSecret: string, salt: string, body: string) =>
  createHmac('sha256', key(serverSecret))
    .update(body + '\0' + salt)
    .digest('base64url')

export function createRememberToken(o: {
  serverSecret: string
  salt: string
  username: string
  ttlSeconds: number
  now?: number
}): string {
  const iat = o.now ?? Math.floor(Date.now() / 1000)
  const body = Buffer.from(
    JSON.stringify({ u: o.username, iat, exp: iat + o.ttlSeconds }),
  ).toString('base64url')
  return `${body}.${mac(o.serverSecret, o.salt, body)}`
}

/** Reads the claimed payload without trusting it; the caller then fetches that user's salt and calls verify. */
export function readRememberToken(token: unknown): RememberPayload | null {
  if (typeof token !== 'string' || token.length > 2048) return null
  const [body, sig, extra] = token.split('.')
  if (!body || !sig || extra !== undefined) return null
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (
      typeof p?.u !== 'string' ||
      !p.u ||
      !Number.isSafeInteger(p.iat) ||
      !Number.isSafeInteger(p.exp) ||
      p.exp <= p.iat
    )
      return null
    return { u: p.u, iat: p.iat, exp: p.exp }
  } catch {
    return null
  }
}

export function verifyRememberToken(
  token: string,
  o: { serverSecret: string; salt: string; now?: number },
): RememberPayload | null {
  const payload = readRememberToken(token)
  if (!payload) return null
  const now = o.now ?? Math.floor(Date.now() / 1000)
  if (payload.exp <= now || payload.iat > now + 30) return null
  const [body, sig] = token.split('.') as [string, string]
  const expected = Buffer.from(mac(o.serverSecret, o.salt, body))
  const actual = Buffer.from(sig)
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return null
  return payload
}
