import { describe, it, expect, vi } from 'vitest'
import {
  resolveOptions,
  resolveSettings,
  publicSettings,
} from '../../src/options'
import { loadSettings } from '../../src/server/config-resolver'

describe('effective configuration validation', () => {
  for (const [key, value] of [
    ['tokenTtlSeconds', -1],
    ['sessionMaxAgeSeconds', 0],
    ['proofOfWorkBits', 25],
    ['proofOfWorkTtlSeconds', NaN],
    ['tokenTtlSeconds', 60.5],
  ] as const) {
    it(`rejects invalid local ${key} before configuration fallback`, () => {
      expect(() =>
        resolveOptions({ defaults: { auth: { [key]: value } } }),
      ).toThrow(/couchdb/)
    })
  }
  it('rejects invalid local enums, roles and nested navigation', () => {
    expect(() =>
      resolveOptions({ defaults: { admin: { theme: 'invalid' as any } } }),
    ).toThrow(/admin_theme/)
    expect(() =>
      resolveOptions({ defaults: { auth: { nostrDmMode: 'invalid' as any } } }),
    ).toThrow(/nostr_dm_mode/)
    expect(() =>
      resolveOptions({ defaults: { admin: { roles: [' '] } } }),
    ).toThrow(/admin_roles/)
    expect(() =>
      resolveOptions({
        admin: {
          sections: [
            {
              id: 'x',
              title: 'X',
              items: [{ label: 'X', route: 'https://foreign.test' }],
            },
          ],
        },
      }),
    ).toThrow(/sections/)
  })
  it('rejects nonboolean capability and config flags supplied by JavaScript', () => {
    expect(() => resolveOptions({ auth: { enabled: 'false' as any } })).toThrow(
      /boolean/,
    )
    expect(() =>
      resolveOptions({ config: { required: 'false' as any } }),
    ).toThrow(/boolean/)
  })
  it('rejects malformed known remote strings without including their values in errors', () => {
    expect(() =>
      resolveSettings(resolveOptions({}), { admin_brand_name: 42 as any }),
    ).toThrow(/admin_brand_name/)
    const secret = { secret: 'sensitive-value' }
    try {
      resolveSettings(resolveOptions({}), { auth_cookie_secret: secret as any })
      throw new Error('accepted')
    } catch (error) {
      expect(String(error)).toMatch(/auth_cookie_secret/)
      expect(String(error)).not.toContain('sensitive-value')
    }
  })
  it('validates merged values even when a caller bypasses setup resolution', () => {
    const options = resolveOptions({})
    options.defaults.auth.tokenTtlSeconds = -1
    expect(() => resolveSettings(options)).toThrow(/auth_token_ttl_seconds/)
  })
  it('validates effective email and challenge prerequisites', () => {
    const email = resolveOptions({ auth: { enabled: true, email: true } })
    expect(() => resolveSettings(email)).toThrow(/auth_token_database/)
    expect(() =>
      resolveSettings(email, { auth_token_database: 'app_tokens' }),
    ).toThrow(/auth_cookie_secret/)
    expect(() =>
      resolveSettings(email, {
        auth_token_database: '_users',
        auth_cookie_secret: 'private',
      }),
    ).toThrow(/auth_token_database/)
    const nostr = resolveOptions({ auth: { enabled: true, nostr: true } })
    expect(() =>
      resolveSettings(nostr, { auth_cookie_secret: 'private' }),
    ).toThrow(/auth_challenge_database/)
    expect(() =>
      resolveSettings(email, { auth_email_enabled: 'false' }),
    ).not.toThrow()
  })
  it('disables method-dependent UI and PoW when remote policy disables every login method', () => {
    const options = resolveOptions({
      auth: { enabled: true, email: true, ui: true, proofOfWork: true },
    })
    const settings = resolveSettings(options, { auth_email_enabled: 'false' })
    expect(settings.features.ui).toBe(false)
    expect(settings.features.proofOfWork).toBe(false)
  })
})

describe('immutable worker policy', () => {
  it('deep-freezes a detached snapshot, including nested navigation and secret objects', async () => {
    const options = resolveOptions({
      auth: { enabled: true, password: true },
      admin: {
        enabled: true,
        sections: [
          {
            id: 'tools',
            title: 'Tools',
            items: [
              { label: 'Home', route: '/admin', requiresRoles: ['admin'] },
            ],
          },
        ],
      },
    })
    const settings = await loadSettings(options)
    expect(Object.isFrozen(settings)).toBe(true)
    expect(() => {
      settings.features.admin = false
    }).toThrow()
    expect(() => settings.admin.roles.push('intruder')).toThrow()
    expect(() => {
      settings.admin.sections[0]!.items[0]!.label = 'Changed'
    }).toThrow()
    expect(() => {
      settings.secrets.cookieSecret = 'changed'
    }).toThrow()
    expect(Object.isFrozen(options.defaults.admin.roles)).toBe(false)
    options.defaults.admin.roles.push('new-local-role')
    expect(settings.admin.roles).toEqual(['admin'])
    const publicCopy = publicSettings(settings)
    publicCopy.admin.roles.push('public-only')
    expect(settings.admin.roles).toEqual(['admin'])
  })
  it('rejects a malformed present section rather than treating it as an optional outage', async () => {
    const options = resolveOptions({
      appSlug: 'test',
      config: { enabled: true, required: false },
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      await expect(
        loadSettings(options, {
          request: async () => Response.json([]),
          json: vi.fn(),
        }),
      ).rejects.toThrow(/section/)
    } finally {
      warn.mockRestore()
    }
  })
  it('does not expose secret values in the public projection', async () => {
    const settings = await loadSettings(resolveOptions({}))
    expect(publicSettings(settings)).not.toHaveProperty('secrets')
  })
})
it('rejects malformed option groups before treating them as disabled', () => {
  expect(() => resolveOptions({ auth: true as any })).toThrow(/auth/)
  expect(() => resolveOptions({ defaults: { auth: [] as any } })).toThrow(
    /defaults.auth/,
  )
})
it('does not share mutable public navigation with worker policy', async () => {
  const options = resolveOptions({
    admin: {
      sections: [
        {
          id: 'tools',
          title: 'Tools',
          items: [{ label: 'Home', route: '/admin' }],
        },
      ],
    },
  })
  const settings = await loadSettings(options),
    projected = publicSettings(settings)
  projected.admin.sections[0]!.items[0]!.label = 'Other'
  expect(settings.admin.sections[0]!.items[0]!.label).toBe('Home')
})
it('rejects invalid local relay URLs and malformed optional JSON bodies', async () => {
  expect(() =>
    resolveOptions({ defaults: { auth: { nostrRelays: ['wss://'] } } }),
  ).toThrow(/nostr_relays/)
  const options = resolveOptions({
    appSlug: 'test',
    config: { enabled: true, required: false },
  })
  await expect(
    loadSettings(options, {
      request: async () => new Response('{broken'),
      json: vi.fn(),
    }),
  ).rejects.toThrow(/section/)
})
