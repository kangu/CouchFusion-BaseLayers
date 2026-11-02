import { describe, it, expect } from 'vitest'
import { createEmailLoginService } from '../../src/features/login-email/server/service'
import {
  createProofOfWorkService,
  validProof,
} from '../../src/features/proof-of-work/server/service'
function memoryClient() {
  const docs = new Map<string, any>()
  return {
    docs,
    async request(path: string, options: RequestInit = {}) {
      const body = options.body ? JSON.parse(String(options.body)) : null
      const [key, query] = path.split('?')
      const doc = docs.get(key)
      if (key === '/_users/_all_docs')
        return Response.json({
          rows: [
            {
              doc: {
                name: 'existing',
                email: 'known@example.test',
                type: 'user',
              },
            },
          ],
        })
      if (options.method === 'PUT') {
        if (doc && body._rev !== doc._rev)
          return Response.json({}, { status: 409 })
        docs.set(key, { ...body, _rev: String(Number(doc?._rev ?? 0) + 1) })
        return Response.json({ ok: true })
      }
      if (options.method === 'DELETE') {
        if (!doc) return Response.json({}, { status: 404 })
        if (new URLSearchParams(query).get('rev') !== doc._rev)
          return Response.json({}, { status: 409 })
        docs.delete(key)
        return Response.json({ ok: true })
      }
      return doc ? Response.json(doc) : Response.json({}, { status: 404 })
    },
    async json(path: string, options?: RequestInit) {
      const r = await this.request(path, options)
      if (!r.ok)
        throw Object.assign(new Error('database'), { statusCode: r.status })
      return r.json()
    },
  }
}
describe('email tokens', () => {
  it('returns indistinguishable responses and never delivers unknown account codes', async () => {
    const client = memoryClient(),
      sent: any[] = []
    const service = createEmailLoginService({
      client,
      database: 'tokens',
      userPrefix: '',
      ttlSeconds: 600,
      appSlug: 'test',
      deliver: async (message) => {
        sent.push(message)
      },
    })
    expect(await service.request('unknown@example.test')).toEqual(
      await service.request('known@example.test'),
    )
    expect(sent).toHaveLength(1)
    expect(sent[0].appSlug).toBe('test')
    expect(JSON.stringify([...client.docs.values()])).not.toContain(
      sent[0].code,
    )
  })
  it('atomically consumes a token once, including concurrent verification', async () => {
    const client = memoryClient()
    let code = ''
    const service = createEmailLoginService({
      client,
      database: 'tokens',
      userPrefix: '',
      ttlSeconds: 600,
      appSlug: 'test',
      deliver: async (message) => {
        code = message.code
      },
    })
    await service.request('known@example.test')
    await expect(service.verify('known@example.test', 'wrong')).rejects.toThrow(
      'Invalid or expired',
    )
    const outcomes = await Promise.allSettled([
      service.verify('known@example.test', code),
      service.verify('known@example.test', code),
    ])
    expect(outcomes.filter((x) => x.status === 'fulfilled')).toHaveLength(1)
    expect((outcomes.find((x) => x.status === 'fulfilled') as any).value).toBe(
      'existing',
    )
  })
  it('rejects expired tokens and cleans failed deliveries without leaking account status', async () => {
    const client = memoryClient()
    let now = 0,
      code = ''
    const service = createEmailLoginService({
      client,
      database: 'tokens',
      userPrefix: '',
      ttlSeconds: 1,
      appSlug: 'test',
      now: () => now,
      deliver: async (m) => {
        code = m.code
      },
    })
    await service.request('known@example.test')
    now = 2000
    await expect(service.verify('known@example.test', code)).rejects.toThrow(
      'Invalid or expired',
    )
    const failed = createEmailLoginService({
      client,
      database: 'tokens2',
      userPrefix: '',
      ttlSeconds: 60,
      appSlug: 'test',
      deliver: async () => {
        throw new Error('provider secret')
      },
    })
    await expect(failed.request('known@example.test')).resolves.toEqual({
      ok: true,
    })
    expect([...client.docs.keys()].some((k) => k.startsWith('/tokens2/'))).toBe(
      false,
    )
  })
})
describe('durable proof of work', () => {
  it('requires a valid proof and consumes it only once', async () => {
    const client = memoryClient()
    const service = createProofOfWorkService({
      client,
      database: 'challenges',
      bits: 4,
      ttlSeconds: 60,
    })
    const challenge = await service.challenge()
    let nonce = 0
    while (!validProof(challenge.id, String(nonce), challenge.bits)) nonce++
    await service.consume(challenge.id, String(nonce))
    await expect(service.consume(challenge.id, String(nonce))).rejects.toThrow(
      'Invalid or expired',
    )
  })
})
