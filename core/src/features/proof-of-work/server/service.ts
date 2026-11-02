import { createHash, randomBytes } from 'node:crypto'
import type { CouchDBClient } from '../../../server/client'
const invalid = () =>
  Object.assign(new Error('Invalid or expired proof of work'), {
    statusCode: 400,
  })
export function validProof(id: string, nonce: string, bits: number) {
  if (!Number.isInteger(bits) || bits < 1 || bits > 24 || nonce.length > 128)
    return false
  const digest = createHash('sha256').update(`${id}:${nonce}`).digest()
  for (let bit = 0; bit < bits; bit++)
    if (digest[Math.floor(bit / 8)]! & (128 >> (bit % 8))) return false
  return true
}
export function createProofOfWorkService(options: {
  client: CouchDBClient
  database: string
  bits: number
  ttlSeconds: number
  now?: () => number
}) {
  const now = options.now ?? Date.now,
    path = (id: string) =>
      `/${encodeURIComponent(options.database)}/${encodeURIComponent(id)}`
  return {
    async challenge() {
      if (
        !Number.isInteger(options.bits) ||
        options.bits < 1 ||
        options.bits > 24
      )
        throw new Error('Invalid proof of work difficulty')
      const id = `pow:${randomBytes(24).toString('hex')}`,
        expiresAt = now() + options.ttlSeconds * 1000
      await options.client.json(path(id), {
        method: 'PUT',
        body: JSON.stringify({
          _id: id,
          type: 'couchdb-pow',
          bits: options.bits,
          expiresAt,
        }),
      })
      return {
        id,
        bits: options.bits,
        expiresAt,
        algorithm: 'sha256',
        input: 'id:nonce',
      }
    },
    async consume(id: unknown, nonce: unknown) {
      if (
        typeof id !== 'string' ||
        !/^pow:[a-f0-9]{48}$/.test(id) ||
        typeof nonce !== 'string' ||
        nonce.length > 128
      )
        throw invalid()
      const result = await options.client.request(path(id))
      if (!result.ok) throw invalid()
      const doc = await result.json()
      if (
        doc.type !== 'couchdb-pow' ||
        doc.expiresAt <= now() ||
        !validProof(id, nonce, doc.bits)
      )
        throw invalid()
      const deleted = await options.client.request(
        `${path(id)}?rev=${encodeURIComponent(doc._rev)}`,
        { method: 'DELETE' },
      )
      if (!deleted.ok) throw invalid()
    },
  }
}
