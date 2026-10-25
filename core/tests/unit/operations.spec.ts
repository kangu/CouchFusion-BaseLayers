import { describe, it, expect } from 'vitest'
import {
  deleteDocument,
  getDocument,
  getLocalDocument,
  getView,
  putAttachment,
  createOrUpdateDesignDocument,
  type OperationClient,
} from '../../src/server/operations'
function fake(responses: Response[]) {
  const calls: Array<[string, RequestInit | undefined]> = []
  const client: OperationClient = {
    request: async (path, init) => {
      calls.push([path, init])
      return responses.shift()!
    },
    json: async () => {
      throw new Error('unused')
    },
  }
  return { client, calls }
}
describe('explicit client operations', () => {
  it('encodes document identifiers and revisions independently', async () => {
    const { client, calls } = fake([Response.json({ ok: true })])
    await deleteDocument(client, 'db/name', 'a/b', '2-a+b&x')
    expect(calls[0]?.[0]).toBe('/db%2Fname/a%2Fb?rev=2-a%2Bb%26x')
  })
  it('distinguishes missing documents from denied access', async () => {
    const { client } = fake([
      new Response('', { status: 404 }),
      new Response('denied', { status: 403 }),
    ])
    expect(await getDocument(client, 'db', 'x')).toBeNull()
    await expect(getDocument(client, 'db', 'x')).rejects.toMatchObject({
      status: 403,
    })
  })
  it('uses the local document namespace without encoding its separator', async () => {
    const { client, calls } = fake([Response.json({ _id: '_local/a/b' })])
    await getLocalDocument(client, 'db', '_local/a/b')
    expect(calls[0]?.[0]).toBe('/db/_local/a%2Fb')
  })
  it('puts view parameters in query and multiple keys in POST body', async () => {
    const { client, calls } = fake([Response.json({ rows: [] })])
    await getView(client, 'db', '_design/test', 'by/name', {
      include_docs: true,
      keys: ['a'],
    })
    expect(calls[0]?.[0]).toBe(
      '/db/_design/test/_view/by%2Fname?include_docs=true',
    )
    expect(JSON.parse(String(calls[0]?.[1]?.body))).toEqual({ keys: ['a'] })
  })
  it('preserves binary attachment bodies and content type', async () => {
    const { client, calls } = fake([Response.json({ ok: true })])
    const data = new Uint8Array([1, 2])
    await putAttachment(client, 'db', 'doc', 'a/b', data, 'image/png', '1-x+y')
    expect(calls[0]?.[1]?.body).toBe(data)
    expect(calls[0]?.[0]).toBe('/db/doc/a%2Fb?rev=1-x%2By')
  })
  it('updates design documents using the current revision', async () => {
    const { client, calls } = fake([
      Response.json({ _id: '_design/a', _rev: '4-current' }),
      Response.json({ ok: true }),
    ])
    await createOrUpdateDesignDocument(client, 'db', {
      _id: 'a',
      language: 'javascript',
      views: {},
    })
    expect(JSON.parse(String(calls[1]?.[1]?.body))._rev).toBe('4-current')
  })
})
