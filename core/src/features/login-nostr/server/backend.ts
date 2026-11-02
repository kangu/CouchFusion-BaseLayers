import { createServiceClient } from '#core/server/client'
import { getDocument, putDocument, getView } from '#core/server/operations'
import type { ChallengeStore, NostrChallenge } from './service'
export function challengeStore(database: string): ChallengeStore {
  if (!database || database.startsWith('_'))
    throw new Error(
      'An existing application challenge database must be configured',
    )
  const client = createServiceClient()
  return {
    async create(record) {
      await putDocument(client, database, record)
    },
    get(id) {
      return getDocument<NostrChallenge>(client, database, id)
    },
    async consume(record) {
      if (!record._rev) throw new Error('Challenge revision missing')
      await putDocument(client, database, record)
    },
  }
}
/** Optional dependency is loaded only after endpoint feature gates succeed. */
export async function nostrBackend() {
  const { verifyEvent, nip19 } = await import('nostr-tools')
  return {
    normalize(input: unknown): string {
      if (typeof input !== 'string')
        throw new Error('Nostr identity is required')
      if (/^[a-f0-9]{64}$/i.test(input)) return input.toLowerCase()
      const decoded = nip19.decode(input)
      if (decoded.type !== 'npub' || typeof decoded.data !== 'string')
        throw new Error('Invalid Nostr identity')
      return decoded.data
    },
    verifySignature: (event: Parameters<typeof verifyEvent>[0]) =>
      verifyEvent(event),
    async resolveUser(pubkey: string, prefix: string): Promise<string | null> {
      const result = await getView(
        createServiceClient(),
        '_users',
        'auth',
        'by_nostr_npub',
        { key: nip19.npubEncode(pubkey), include_docs: true, limit: 2 },
      )
      if (result.rows.length !== 1) return null
      const doc = result.rows[0]?.doc
      if (
        !doc ||
        doc.type !== 'user' ||
        typeof doc.name !== 'string' ||
        !doc.name.startsWith(prefix) ||
        doc._id !== `org.couchdb.user:${doc.name}` ||
        doc.nostr?.pubkey !== pubkey
      )
        return null
      return doc.name
    },
  }
}
