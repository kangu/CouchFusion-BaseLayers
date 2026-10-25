import { it, expect } from 'vitest'
import { featureManifest } from '../../src/register'
import { resolveOptions } from '../../src/options'
it('registers no auth/admin route, middleware, plugin or page by default', () => {
  expect(featureManifest(resolveOptions({}).features)).toEqual({
    routes: [],
    pages: [],
    middleware: [],
    plugins: [],
  })
})
it('registers native password, SSR middleware and admin without unrelated providers', () => {
  const m = featureManifest(
    resolveOptions({
      auth: { enabled: true, password: true, ui: true },
      admin: { enabled: true },
    }).features,
  )
  expect(m.routes).toContain('/api/couchdb/login/password')
  expect(m.middleware).toContain('couchdb-session')
  expect(m.pages).toContain('/admin')
  expect(
    m.routes.some(
      (r) =>
        r.includes('nostr') || r.includes('datasync') || r.includes('email'),
    ),
  ).toBe(false)
})
