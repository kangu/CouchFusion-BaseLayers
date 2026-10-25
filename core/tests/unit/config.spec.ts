import { describe, it, expect } from 'vitest'
import {
  resolveOptions,
  resolveSettings,
  publicSettings,
  safeRedirect,
} from '../../src/options'
describe('explicit capability/configuration boundary', () => {
  it('defaults to database only and requires no optional dependency or credential', () => {
    const o = resolveOptions({})
    expect(Object.values(o.features).every((v) => v === false)).toBe(true)
    expect(o.config.enabled).toBe(false)
  })
  it('rejects implicit parents', () => {
    expect(() => resolveOptions({ auth: { password: true } })).toThrow(
      /auth.enabled/,
    )
    expect(() => resolveOptions({ admin: { enabled: true } })).toThrow(
      /auth.enabled/,
    )
    expect(() =>
      resolveOptions({ auth: { enabled: true }, admin: { dataSync: true } }),
    ).toThrow(/admin.enabled/)
  })
  it('remote flags cannot add absent code, and a disabled parent disables children', () => {
    const core = resolveSettings(resolveOptions({}), { admin_enabled: 'true' })
    expect(core.features.admin).toBe(false)
    const o = resolveOptions({
      appSlug: 'cf-cloud',
      auth: { enabled: true, password: true, ui: true },
      admin: { enabled: true, dataSync: true },
    })
    expect(
      resolveSettings(o, { admin_enabled: 'false' }).features.dataSync,
    ).toBe(false)
    expect(
      resolveSettings(o, { auth_password_enabled: 'false' }).features.password,
    ).toBe(false)
  })
  it('parses flat runtime policy and never exposes secrets', () => {
    const o = resolveOptions({
      appSlug: 'cf-cloud',
      auth: { enabled: true, password: true },
      admin: { enabled: true },
    })
    const s = resolveSettings(o, {
      admin_roles: 'admin,operator',
      admin_brand_name: 'CF Cloud',
      auth_cookie_secret: 'private-secret',
      nostr_sender_nsec: 'private-key',
    })
    expect(s.admin.roles).toEqual(['admin', 'operator'])
    expect(s.admin.brandName).toBe('CF Cloud')
    expect(JSON.stringify(publicSettings(s))).not.toMatch(
      /private-secret|private-key|cookieSecret|senderNsec/,
    )
    expect(() => resolveSettings(o, { admin_enabled: 'yes' })).toThrow(
      /boolean/,
    )
    expect(() => resolveSettings(o, { admin_roles: '' })).toThrow(/roles/)
  })
  it('requires a stable app slug for remote configuration', () => {
    expect(() => resolveOptions({ config: { enabled: true } })).toThrow(
      /appSlug/,
    )
    expect(
      resolveOptions({ appSlug: 'CF Cloud', config: { enabled: true } })
        .appSlug,
    ).toBe('cf-cloud')
  })
  it('rejects redirect schemes, protocol-relative paths and backslashes', () => {
    for (const path of [
      'https://evil.test',
      '//evil.test',
      '/\\evil.test',
      'javascript:evil',
    ])
      expect(safeRedirect(path, '/admin')).toBe('/admin')
    expect(safeRedirect('/admin?tab=home', '/')).toBe('/admin?tab=home')
  })
})
it('validates malformed known remote flags even when the feature is not compiled', () => {
  expect(() =>
    resolveSettings(resolveOptions({}), { admin_enabled: 'yes' }),
  ).toThrow(/boolean/)
})
