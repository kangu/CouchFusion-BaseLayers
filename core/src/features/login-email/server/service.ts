import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { CouchDBClient } from '../../../server/client'
export interface EmailDeliveryMessage {
  email: string
  code: string
  expiresAt: string
  appSlug: string
  tokenDocumentId: string
}
export type EmailDelivery = (message: EmailDeliveryMessage) => Promise<void>
interface Options {
  client: CouchDBClient
  database: string
  userPrefix: string
  ttlSeconds: number
  appSlug: string
  deliver: EmailDelivery
  now?: () => number
}
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const invalid = () =>
  Object.assign(new Error('Invalid or expired email code'), { statusCode: 401 })
const success = () => ({ ok: true as const })
export function normalizeEmail(value: unknown) {
  if (
    typeof value !== 'string' ||
    value.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  )
    throw Object.assign(new Error('A valid email address is required'), {
      statusCode: 400,
    })
  return value.trim().toLowerCase()
}
export function createEmailLoginService(options: Options) {
  const { client } = options,
    now = options.now ?? Date.now
  const tokenId = (email: string) =>
    `email:${hash(`${options.appSlug}:${email}`)}`
  const path = (id: string) =>
    `/${encodeURIComponent(options.database)}/${encodeURIComponent(id)}`
  const read = async (id: string) => {
    const r = await client.request(path(id))
    if (r.status === 404) return null
    if (!r.ok)
      throw Object.assign(new Error('Email token store unavailable'), {
        statusCode: 503,
      })
    return r.json()
  }
  async function account(email: string) {
    const start = `org.couchdb.user:${options.userPrefix}`,
      end = `${start}\ufff0`
    let cursor = start,
      skip = 0,
      match: string | undefined
    do {
      const query = new URLSearchParams({
        include_docs: 'true',
        startkey: JSON.stringify(cursor),
        endkey: JSON.stringify(end),
        limit: '500',
        skip: String(skip),
      })
      const result = await client.json<{
        rows: Array<{ key: string; doc?: any }>
      }>(`/_users/_all_docs?${query}`)
      for (const row of result.rows) {
        const doc = row.doc
        if (
          doc?.type === 'user' &&
          typeof doc.name === 'string' &&
          doc.name.startsWith(options.userPrefix) &&
          typeof doc.email === 'string' &&
          doc.email.trim().toLowerCase() === email
        ) {
          if (match && match !== doc.name) return undefined
          match = doc.name
        }
      }
      if (result.rows.length < 500) return match
      cursor = result.rows[result.rows.length - 1]!.key
      skip = 1
    } while (true)
  }
  return {
    async request(input: unknown) {
      const email = normalizeEmail(input),
        username = await account(email)
      if (!username) return success()
      const id = tokenId(email),
        previous = await read(id),
        time = now()
      if (previous && time - previous.createdAt < 60000) return success()
      const code = randomBytes(16).toString('hex'),
        expiresAt = time + options.ttlSeconds * 1000
      const stored = await client.request(path(id), {
        method: 'PUT',
        body: JSON.stringify({
          _id: id,
          ...(previous ? { _rev: previous._rev } : {}),
          type: 'couchdb-email-login',
          appSlug: options.appSlug,
          username,
          codeHash: hash(code),
          createdAt: time,
          expiresAt,
        }),
      })
      if (stored.status === 409) return success()
      if (!stored.ok)
        throw Object.assign(new Error('Email token store unavailable'), {
          statusCode: 503,
        })
      try {
        await options.deliver({
          email,
          code,
          expiresAt: new Date(expiresAt).toISOString(),
          appSlug: options.appSlug,
          tokenDocumentId: id,
        })
      } catch {
        const current = await read(id)
        if (current?.codeHash === hash(code))
          await client.request(
            `${path(id)}?rev=${encodeURIComponent(current._rev)}`,
            { method: 'DELETE' },
          )
      }
      return success()
    },
    async verify(input: unknown, code: unknown) {
      const email = normalizeEmail(input)
      if (typeof code !== 'string' || !/^[a-f0-9]{32}$/.test(code))
        throw invalid()
      const id = tokenId(email),
        doc = await read(id)
      if (
        !doc ||
        doc.type !== 'couchdb-email-login' ||
        doc.appSlug !== options.appSlug ||
        typeof doc.codeHash !== 'string' ||
        !/^[a-f0-9]{64}$/.test(doc.codeHash) ||
        doc.expiresAt <= now() ||
        !timingSafeEqual(
          Buffer.from(hash(code), 'hex'),
          Buffer.from(doc.codeHash, 'hex'),
        )
      )
        throw invalid()
      const consumed = await client.request(
        `${path(id)}?rev=${encodeURIComponent(doc._rev)}`,
        { method: 'DELETE' },
      )
      if (!consumed.ok) throw invalid()
      return doc.username as string
    },
  }
}
