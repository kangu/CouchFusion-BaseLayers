import { randomBytes } from 'node:crypto'
import { describe, it, expect } from 'vitest'
import {
  createLocalTestRun,
  localRequest,
  poll,
  readLocalTestConfig,
  requireOk,
} from '../helpers/local-harness'

describe('local CouchDB real primitives', () => {
  it('CRUD, revisions, local docs, bulk, indexed views, attachment bytes, security and native sessions', async () => {
    const config = await readLocalTestConfig()
    const run = await createLocalTestRun(config)
    const started = performance.now()
    let failed = true
    const json = (body: unknown, method = 'PUT'): RequestInit => ({
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    try {
      const db = await run.database()
      const request = (path: string, init?: RequestInit) =>
        localRequest(config, `/${db}${path}`, init)
      const created = await requireOk(
        await request('/doc', json({ kind: 'sample', value: 1 })),
      )
      expect((await requireOk(await request('/doc'))).value).toBe(1)
      expect((await request('/doc', json({ value: 2 }))).status).toBe(409)
      const updated = await requireOk(
        await request(
          '/doc',
          json({ _rev: created.rev, kind: 'sample', value: 2 }),
        ),
      )
      await requireOk(await request('/_local/state', json({ value: 'local' })))
      expect((await requireOk(await request('/_local/state'))).value).toBe(
        'local',
      )
      const bulk = await requireOk(
        await request(
          '/_bulk_docs',
          json(
            {
              docs: [
                { _id: 'bulk-a', kind: 'sample', value: 3 },
                { _id: 'bulk-b', kind: 'sample', value: 4 },
              ],
            },
            'POST',
          ),
        ),
      )
      expect(bulk.every((item: any) => item.ok)).toBe(true)
      await requireOk(
        await request(
          '/_design/owned',
          json({
            views: {
              samples: {
                map: 'function(doc) { if(doc.kind === "sample") emit(doc._id, doc.value); }',
              },
            },
          }),
        ),
      )
      const view = await poll(
        config,
        async () => requireOk(await request('/_design/owned/_view/samples')),
        (value) => value.rows.length === 3,
      )
      expect(view.rows.map((row: any) => row.value)).toEqual([3, 4, 2])
      const bytes = new Uint8Array([0, 255, 17, 13, 10, 42])
      await requireOk(
        await request(`/doc/blob?rev=${updated.rev}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: bytes,
        }),
      )
      expect(
        new Uint8Array(await (await request('/doc/blob')).arrayBuffer()),
      ).toEqual(bytes)
      const username = `couchdb_test_${run.runId}`
      const userId = await run.register({
        kind: 'user',
        id: `org.couchdb.user:${username}`,
      })
      const password = randomBytes(24).toString('hex')
      await requireOk(
        await localRequest(
          config,
          `/_users/${encodeURIComponent(userId)}`,
          json({
            _id: userId,
            name: username,
            password,
            roles: [],
            type: 'user',
            testRunMarker: run.marker,
          }),
        ),
      )
      const session = await poll(
        config,
        () =>
          localRequest(
            config,
            '/_session',
            json({ name: username, password }, 'POST'),
          ),
        (response) => response.ok,
      )
      const cookie = session.headers.get('set-cookie')?.split(';')[0]
      expect(cookie).toBeTruthy()
      await requireOk(
        await request(
          '/_security',
          json({
            admins: { names: [], roles: [] },
            members: { names: [username], roles: [] },
          }),
        ),
      )
      const anonymousHeaders = {
        Authorization:
          'Basic ' + Buffer.from('invalid:invalid').toString('base64'),
      }
      expect([401, 403]).toContain(
        (await request('/doc', { headers: anonymousHeaders })).status,
      )
      expect(
        (await request('/doc', { headers: { Cookie: cookie! } })).status,
      ).toBe(200)
      await requireOk(
        await request(
          '/_security',
          json({
            admins: { names: [], roles: [] },
            members: { names: [], roles: ['unassigned-test-role'] },
          }),
        ),
      )
      expect([401, 403]).toContain(
        (await request('/doc', { headers: { Cookie: cookie! } })).status,
      )
      expect(
        (
          await localRequest(config, '/_session', {
            method: 'DELETE',
            headers: { Cookie: cookie! },
          })
        ).ok,
      ).toBe(true)
      const section = await run.register({
        kind: 'config',
        id: `cf_env_couchdb_test_${run.runId}`,
      })
      await requireOk(
        await localRequest(
          config,
          `/_node/_local/_config/${section}/test_run_marker`,
          json(run.marker),
        ),
      )
      await requireOk(
        await localRequest(
          config,
          `/_node/_local/_config/${section}/sample`,
          json('isolated'),
        ),
      )
      expect(
        await requireOk(
          await localRequest(config, `/_node/_local/_config/${section}/sample`),
        ),
      ).toBe('isolated')
      const latest = await requireOk(await request('/doc'))
      await requireOk(
        await request(`/doc?rev=${latest._rev}`, { method: 'DELETE' }),
      )
      expect((await request('/doc')).status).toBe(404)
      failed = false
    } finally {
      if (!failed || !config.keepFailedResources) await run.cleanup()
      else
        console.info(
          `Preserved local test run ${run.runId}; use test:cleanup ${run.runId}`,
        )
      if (config.reportTimings)
        console.info(
          `Local CouchDB primitives ${Math.round(performance.now() - started)}ms (slow threshold ${config.slowThresholdMs}ms; report only)`,
        )
    }
  }, 45000)
})
