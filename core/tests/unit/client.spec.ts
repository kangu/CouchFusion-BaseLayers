import { it, expect, vi } from 'vitest'
import {
  createServiceClient,
  createSessionClient,
  getBootstrapConfig,
} from '../../src/server/client'
it('never gives caller requests server credentials', async () => {
  const fetcher = vi.fn(async () => new Response('{}'))
  const client = createSessionClient(
    { url: 'http://localhost:5984', fetch: fetcher },
    'session-token',
  )
  await client.request('/_session')
  const headers = new Headers(fetcher.mock.calls[0]![1]?.headers)
  expect(headers.get('cookie')).toBe('AuthSession=session-token')
  expect(headers.has('authorization')).toBe(false)
})
it('sets explicit service credentials and rejects off-host paths', async () => {
  const fetcher = vi.fn(async () => new Response('{}'))
  const client = createServiceClient({
    adminAuth: 'YWRtaW46dGVzdA==',
    fetch: fetcher,
  })
  await client.request('/test')
  expect(
    new Headers(fetcher.mock.calls[0]![1]?.headers).get('authorization'),
  ).toBe('Basic YWRtaW46dGVzdA==')
  await expect(client.request('http://evil.test/')).rejects.toThrow(/relative/)
})
it('uses only inherited admin auth and the local bootstrap address', () => {
  expect(() => getBootstrapConfig({})).toThrow(/COUCHDB_ADMIN_AUTH/)
  expect(
    getBootstrapConfig({
      COUCHDB_ADMIN_AUTH: 'YWRtaW46dGVzdA==',
      COUCHDB_URL: 'http://evil.test',
    }).url,
  ).toBe('http://localhost:5984')
})
