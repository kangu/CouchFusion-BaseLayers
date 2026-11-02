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
describe('admin colour scheme', () => {
  const o = () =>
    resolveOptions({ appSlug: 'cf-cloud', auth: { enabled: true, password: true, ui: true }, admin: { enabled: true } })
  it('defaults to the system setting and reaches the client', () => {
    expect(o().defaults.admin.theme).toBe('system')
    expect(publicSettings(resolveSettings(o(), {})).admin.theme).toBe('system')
  })
  it('accepts light and dark, and reads the retired skins as system', () => {
    expect(resolveSettings(o(), { admin_theme: 'dark' }).admin.theme).toBe('dark')
    expect(resolveSettings(o(), { admin_theme: 'light' }).admin.theme).toBe('light')
    expect(resolveSettings(o(), { admin_theme: 'ledger' }).admin.theme).toBe('system')
    expect(resolveOptions({ defaults: { admin: { theme: 'classic' as never } } }).defaults.admin.theme).toBe('system')
  })
  it('reads a retired skin in previously generated options as system', () => {
    const stale = o()
    ;(stale.defaults.admin as { theme: string }).theme = 'ledger'
    expect(resolveSettings(stale, {}).admin.theme).toBe('system')
  })
  it('rejects unknown schemes', () => {
    expect(() => resolveSettings(o(), { admin_theme: 'blue' })).toThrow(/admin_theme/)
  })
})
describe('remembered login setting', () => {
  const o = () => resolveOptions({ appSlug: 'cf-cloud', auth: { enabled: true, password: true } })
  it('defaults to 12 months and accepts 0 to turn it off', () => {
    expect(resolveSettings(o(), {}).auth.rememberSeconds).toBe(31536000)
    expect(resolveSettings(o(), { auth_remember_seconds: '0' }).auth.rememberSeconds).toBe(0)
    expect(resolveSettings(o(), { auth_remember_seconds: '2592000' }).auth.rememberSeconds).toBe(2592000)
  })
  it('rejects values past a year and fills it in for previously generated options', () => {
    expect(() => resolveSettings(o(), { auth_remember_seconds: '31536001' })).toThrow(/auth_remember_seconds/)
    const stale = o()
    delete (stale.defaults.auth as { rememberSeconds?: number }).rememberSeconds
    expect(resolveSettings(stale, {}).auth.rememberSeconds).toBe(31536000)
  })
})
