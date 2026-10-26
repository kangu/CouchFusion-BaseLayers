import { describe, expect, it } from 'vitest'
import {
  createDatabase,
  createOrUpdateDesignDocument,
  initializeDatabase,
  setDatabaseSecurity,
  type OperationClient,
  type CouchDBDesignDocument,
} from '../../src/server/operations'

const security = {
  admins: { names: ['owner'], roles: [] },
  members: { names: [], roles: ['reader'] },
}
const design: CouchDBDesignDocument = {
  _id: 'lookup',
  language: 'javascript',
  views: {
    byKind: {
      map: 'function(doc) { emit(doc.kind, null); }',
      reduce: '_count',
    },
  },
}
function transport(responses: Response[]) {
  const calls: Array<{ path: string; init?: RequestInit }> = []
  const client: OperationClient = {
    request: async (path, init) => {
      calls.push({ path, init })
      const response = responses.shift()
      if (!response) throw new Error('Unexpected request')
      return response
    },
    json: async () => {
      throw new Error('unused')
    },
  }
  return { client, calls }
}
describe('safe explicit provisioning', () => {
  it('reports creation separately from an existing database', async () => {
    const { client } = transport([
      Response.json({ ok: true }, { status: 201 }),
      new Response('', { status: 412 }),
    ])
    expect(await createDatabase(client, 'db')).toBe(true)
    expect(await createDatabase(client, 'db')).toBe(false)
  })
  it('preserves an existing database security policy during initialization', async () => {
    const { client, calls } = transport([
      new Response('', { status: 412 }),
      Response.json({ ok: true }),
    ])
    await initializeDatabase(client, 'db', security)
    expect(calls.map((c) => c.path)).toEqual(['/db'])
  })
  it('sets explicit security on a newly created database', async () => {
    const { client, calls } = transport([
      Response.json({ ok: true }, { status: 201 }),
      Response.json({ ok: true }),
    ])
    await initializeDatabase(client, 'db', security)
    expect(calls[1]?.path).toBe('/db/_security')
    expect(JSON.parse(String(calls[1]?.init?.body))).toEqual(security)
  })
  it('allows a separately explicit security policy update', async () => {
    const { client, calls } = transport([Response.json({ ok: true })])
    await setDatabaseSecurity(client, 'db', security)
    expect(calls[0]?.init?.method).toBe('PUT')
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual(security)
  })
  it('leaves semantically identical design documents untouched despite key order and server metadata', async () => {
    const { client, calls } = transport([
      Response.json({
        views: { byKind: { reduce: '_count', map: design.views.byKind!.map } },
        language: 'javascript',
        _id: '_design/lookup',
        _rev: '3-current',
        _revisions: { start: 3, ids: ['current'] },
        _conflicts: ['2-other'],
        _local_seq: 7,
      }),
      Response.json({ ok: true }),
    ])
    expect(
      await createOrUpdateDesignDocument(client, 'db', {
        ...design,
        _rev: '1-stale',
      }),
    ).toEqual({ ok: true, id: '_design/lookup', rev: '3-current' })
    expect(calls).toHaveLength(1)
  })
  it.each(['map', 'validate_doc_update', 'options'])(
    'updates meaningful %s changes using the current revision',
    async (field) => {
      const { client, calls } = transport([
        Response.json({ ...design, _id: '_design/lookup', _rev: '3-current' }),
        Response.json({ ok: true, rev: '4-next' }),
      ])
      const changed =
        field === 'map'
          ? {
              ...design,
              views: { byKind: { map: 'function(doc) { emit(doc._id, 1); }' } },
            }
          : {
              ...design,
              [field]:
                field === 'options'
                  ? { partitioned: false }
                  : 'function(newDoc) { if (!newDoc.kind) throw({forbidden:"kind"}); }',
            }
      expect(
        await createOrUpdateDesignDocument(client, 'db', changed),
      ).toMatchObject({ rev: '4-next' })
      expect(JSON.parse(String(calls[1]?.init?.body))._rev).toBe('3-current')
    },
  )
  it('creates missing designs and propagates denied reads and write conflicts', async () => {
    const missing = transport([
      new Response('', { status: 404 }),
      Response.json({ ok: true }),
    ])
    await createOrUpdateDesignDocument(missing.client, 'db', design)
    expect(missing.calls[1]?.init?.method).toBe('PUT')
    const denied = transport([new Response('denied', { status: 403 })])
    await expect(
      createOrUpdateDesignDocument(denied.client, 'db', design),
    ).rejects.toMatchObject({ status: 403 })
    const conflict = transport([
      Response.json({ ...design, _rev: '1-old' }),
      new Response('conflict', { status: 409 }),
    ])
    await expect(
      createOrUpdateDesignDocument(conflict.client, 'db', {
        ...design,
        views: {},
      }),
    ).rejects.toMatchObject({ status: 409 })
  })
  it('propagates creation errors without attempting policy writes', async () => {
    const { client, calls } = transport([
      new Response('denied', { status: 403 }),
    ])
    await expect(
      initializeDatabase(client, 'db', security),
    ).rejects.toMatchObject({ status: 403 })
    expect(calls).toHaveLength(1)
  })
})
