import { describe, it, expect, vi } from 'vitest'
import {
  readLocalTestConfig,
  assertOwnedResource,
  localRequest,
} from '../helpers/local-harness'
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status })
describe('local harness configuration and ownership', () => {
  it('requires credentials before making requests', async () => {
    await expect(readLocalTestConfig({ env: {} })).rejects.toThrow(
      'COUCHDB_ADMIN_AUTH',
    )
  })
  it('uses defaults when the optional config section is missing', async () => {
    const config = await readLocalTestConfig({
      env: {
        COUCHDB_ADMIN_AUTH: Buffer.from('admin:secret').toString('base64'),
      },
      fetch: async () => response({}, 404),
    })
    expect(config.httpTimeoutMs).toBe(3000)
    expect(config.readyTimeoutMs).toBe(5000)
    expect(config.keepFailedResources).toBe(false)
  })
  it('fails for inaccessible config and invalid timeout values', async () => {
    await expect(
      readLocalTestConfig({
        env: { COUCHDB_ADMIN_AUTH: Buffer.from('a:b').toString('base64') },
        fetch: async () => response({}, 403),
      }),
    ).rejects.toThrow('403')
    await expect(
      readLocalTestConfig({
        env: { COUCHDB_ADMIN_AUTH: Buffer.from('a:b').toString('base64') },
        fetch: async () => response({ test_http_timeout_ms: 1 }),
      }),
    ).rejects.toThrow('test_http_timeout_ms')
  })
  it('rejects invalid booleans and malformed credentials', async () => {
    await expect(
      readLocalTestConfig({ env: { COUCHDB_ADMIN_AUTH: 'admin:' } }),
    ).rejects.toThrow('COUCHDB_ADMIN_AUTH')
    await expect(
      readLocalTestConfig({
        env: { COUCHDB_ADMIN_AUTH: Buffer.from('a:b').toString('base64') },
        fetch: async () => response({ test_report_timings: 'yes' }),
      }),
    ).rejects.toThrow('test_report_timings')
  })
  it('rejects shared or mismatched IDs even when presented as owned', () => {
    expect(() =>
      assertOwnedResource('a'.repeat(24), { kind: 'database', id: '_users' }),
    ).toThrow()
    expect(() =>
      assertOwnedResource('../unsafe', { kind: 'database', id: 'anything' }),
    ).toThrow()
    expect(() =>
      assertOwnedResource('a'.repeat(24), {
        kind: 'unknown' as any,
        id: 'couchdb_test_' + 'a'.repeat(24),
      }),
    ).toThrow()
    expect(() =>
      assertOwnedResource('a'.repeat(24), {
        kind: 'database',
        id: 'couchdb_test_' + 'b'.repeat(24),
      }),
    ).toThrow()
    expect(() =>
      assertOwnedResource('a'.repeat(24), {
        kind: 'database',
        id: 'couchdb_test_' + 'a'.repeat(24),
      }),
    ).not.toThrow()
  })
})

it('accepts only the fixed dotted CouchDB user prefix', () => {
  const runId = 'a'.repeat(24)
  expect(() =>
    assertOwnedResource(runId, {
      kind: 'user',
      id: `org.couchdb.user:couchdb_test_${runId}`,
    }),
  ).not.toThrow()
  expect(() =>
    assertOwnedResource(runId, {
      kind: 'user',
      id: `org.couchdb.user:couchdb_test_${runId}_suffix`,
    }),
  ).not.toThrow()
  expect(() =>
    assertOwnedResource(runId, {
      kind: 'user',
      id: `org.couchdb.user:couchdb_test_${runId}_bad.suffix`,
    }),
  ).toThrow()
  expect(() =>
    assertOwnedResource(runId, {
      kind: 'database',
      id: `couchdb_test_${runId}_bad.suffix`,
    }),
  ).toThrow()
})
it('supports a bounded per-operation timeout without leaking service credentials to cookie requests', async () => {
  const timeout = vi.spyOn(AbortSignal, 'timeout')
  const fetcher = vi.fn(async () => Response.json({ ok: true }))
  vi.stubGlobal('fetch', fetcher)
  try {
    const config = {
      auth: 'test-service-auth',
      httpTimeoutMs: 3000,
      readyTimeoutMs: 5000,
      slowThresholdMs: 1000,
      reportTimings: true,
      keepFailedResources: false,
    }
    await localRequest(
      config,
      '/_replicate',
      { headers: { Cookie: 'AuthSession=owned-session' } },
      { timeoutMs: 15000 },
    )
    expect(timeout).toHaveBeenLastCalledWith(15000)
    const headers = new Headers(fetcher.mock.calls[0]![1]?.headers)
    expect(headers.get('cookie')).toBe('AuthSession=owned-session')
    expect(headers.has('authorization')).toBe(false)
  } finally {
    vi.unstubAllGlobals()
    timeout.mockRestore()
  }
})
it('permits independent timing-report thresholds without changing request deadlines', async () => {
  const config = await readLocalTestConfig({
    env: { COUCHDB_ADMIN_AUTH: Buffer.from('a:b').toString('base64') },
    fetch: async () => response({ test_slow_threshold_ms: '1' }),
  })
  expect(config.slowThresholdMs).toBe(1)
  expect(config.httpTimeoutMs).toBe(3000)
})
