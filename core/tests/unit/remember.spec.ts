import { describe, expect, it } from 'vitest'
import {
  createRememberToken,
  readRememberToken,
  verifyRememberToken,
} from '../../src/server/remember'

const base = { serverSecret: 'server-secret', salt: 'salt-1', username: 'ana', ttlSeconds: 31536000, now: 1_800_000_000 }

describe('remembered login token', () => {
  it('verifies for its owner until it expires', () => {
    const t = createRememberToken(base)
    expect(readRememberToken(t)).toEqual({ u: 'ana', iat: base.now, exp: base.now + base.ttlSeconds })
    expect(verifyRememberToken(t, { ...base, now: base.now + 364 * 86400 })?.u).toBe('ana')
    expect(verifyRememberToken(t, { ...base, now: base.now + base.ttlSeconds })).toBeNull()
  })
  it('stops working when the password (salt) or the server secret changes', () => {
    const t = createRememberToken(base)
    expect(verifyRememberToken(t, { ...base, salt: 'salt-2' })).toBeNull()
    expect(verifyRememberToken(t, { ...base, serverSecret: 'rotated' })).toBeNull()
  })
  it('rejects edits to the claimed user or dates', () => {
    const t = createRememberToken(base)
    const [, sig] = t.split('.')
    const forged = Buffer.from(JSON.stringify({ u: 'admin', iat: base.now, exp: base.now + 10 })).toString('base64url') + '.' + sig
    expect(verifyRememberToken(forged, base)).toBeNull()
    const longer = Buffer.from(JSON.stringify({ u: 'ana', iat: base.now, exp: base.now + 10 * base.ttlSeconds })).toString('base64url') + '.' + sig
    expect(verifyRememberToken(longer, { ...base, now: base.now + 2 * base.ttlSeconds })).toBeNull()
  })
  it('treats malformed input as no token', () => {
    for (const bad of [undefined, '', 'abc', 'a.b.c', 'x'.repeat(3000), Buffer.from('{"u":1}').toString('base64url') + '.sig'])
      expect(readRememberToken(bad)).toBeNull()
  })
  it('rejects tokens issued in the future', () => {
    const t = createRememberToken({ ...base, now: base.now + 3600 })
    expect(verifyRememberToken(t, base)).toBeNull()
  })
})
