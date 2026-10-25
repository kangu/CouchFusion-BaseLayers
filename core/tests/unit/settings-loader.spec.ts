import { it, expect, vi } from 'vitest'
import { loadSettings } from '../../src/server/config-resolver'
import { resolveOptions } from '../../src/options'
const o = () =>
  resolveOptions({ appSlug: 'cf-cloud', config: { enabled: true } })
it('does not contact CouchDB for default database-only setup', async () => {
  const request = vi.fn()
  await loadSettings(resolveOptions({}), { request, json: vi.fn() })
  expect(request).not.toHaveBeenCalled()
})
it('loads only the current app section and applies its flat keys', async () => {
  const request = vi.fn(async () =>
    Response.json({ admin_brand_name: 'From CouchDB' }),
  )
  const settings = await loadSettings(o(), { request, json: vi.fn() })
  expect(settings.admin.brandName).toBe('From CouchDB')
  expect(request).toHaveBeenCalledWith('/_node/_local/_config/cf_env_cf-cloud')
})
it('fails required config, permits explicit optional fallback, rejects malformed present values', async () => {
  const request = vi.fn(async () => new Response('', { status: 404 })),
    client = { request, json: vi.fn() }
  await expect(loadSettings(o(), client)).rejects.toThrow(/Required/)
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const settings = await loadSettings(
    { ...o(), config: { enabled: true, required: false } },
    client,
  )
  expect(settings.admin.brandName).toBe('CouchFusion')
  warn.mockRestore()
  await expect(
    loadSettings(o(), {
      request: async () => Response.json({ admin_enabled: 'yes' }),
      json: vi.fn(),
    }),
  ).rejects.toThrow(/boolean/)
})
