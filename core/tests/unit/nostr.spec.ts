import { describe, expect, it } from 'vitest'
import {
  issueChallenge,
  verifyChallenge,
  type ChallengeStore,
  type NostrLoginEvent,
  type NostrChallenge,
} from '../../src/features/login-nostr/server/service'
function fixture() {
  const records = new Map<string, NostrChallenge>()
  const store: ChallengeStore = {
    create: async (doc) => {
      records.set(doc._id, { ...doc, _rev: '1-first' })
    },
    get: async (id) => structuredClone(records.get(id) || null),
    consume: async (doc) => {
      const current = records.get(doc._id)
      if (current?.consumedAt || current?._rev !== doc._rev)
        throw new Error('conflict')
      records.set(doc._id, { ...doc, consumedAt: 1000, _rev: '2-used' })
    },
  }
  const input = {
    store,
    appSlug: 'test',
    pubkey: 'a'.repeat(64),
    verifyUrl: 'https://app.test/api/couchdb/login/nostr/verify',
    now: 1000,
  }
  return { store, records, input }
}
function signed(
  challenge: { id: string; message: string },
  pubkey: string,
): NostrLoginEvent {
  return {
    id: 'b'.repeat(64),
    sig: 'c'.repeat(128),
    pubkey,
    kind: 27235,
    created_at: 1,
    content: challenge.message,
    tags: [
      ['challenge', challenge.message],
      ['u', 'https://app.test/api/couchdb/login/nostr/verify'],
      ['method', 'POST'],
    ],
  }
}
describe('durable Nostr challenges', () => {
  it('stores bound expiring cryptographic challenges and consumes before login', async () => {
    const { input } = fixture()
    const challenge = await issueChallenge(input)
    expect(challenge.id).toMatch(/^nostr:/)
    expect(challenge.message).toContain('nostr-login:')
    const options = {
      ...input,
      id: challenge.id,
      event: signed(challenge, input.pubkey),
      verifySignature: () => true,
      resolveUser: async () => 'existing-user',
    }
    expect(await verifyChallenge(options)).toBe('existing-user')
    await expect(verifyChallenge(options)).rejects.toThrow()
  })
  it('rejects expiry, invalid signature, wrong pubkey, kind and tags', async () => {
    for (const mutate of [
      (e: NostrLoginEvent) => {
        e.pubkey = 'd'.repeat(64)
      },
      (e: NostrLoginEvent) => {
        e.kind = 1
      },
      (e: NostrLoginEvent) => {
        e.tags = []
      },
      (e: NostrLoginEvent) => {
        e.content = 'wrong'
      },
    ]) {
      const { input } = fixture()
      const challenge = await issueChallenge(input)
      const event = signed(challenge, input.pubkey)
      mutate(event)
      await expect(
        verifyChallenge({
          ...input,
          id: challenge.id,
          event,
          verifySignature: () => true,
          resolveUser: async () => 'user',
        }),
      ).rejects.toThrow()
    }
    const { input } = fixture()
    const challenge = await issueChallenge(input)
    await expect(
      verifyChallenge({
        ...input,
        now: challenge.expiresAt,
        id: challenge.id,
        event: signed(challenge, input.pubkey),
        verifySignature: () => true,
        resolveUser: async () => 'user',
      }),
    ).rejects.toThrow()
    await expect(
      verifyChallenge({
        ...input,
        id: challenge.id,
        event: signed(challenge, input.pubkey),
        verifySignature: () => false,
        resolveUser: async () => 'user',
      }),
    ).rejects.toThrow()
  })
  it('allows only one concurrent verifier and never creates an unlinked user', async () => {
    const { input } = fixture()
    const challenge = await issueChallenge(input)
    const options = {
      ...input,
      id: challenge.id,
      event: signed(challenge, input.pubkey),
      verifySignature: () => true,
      resolveUser: async () => 'existing',
    }
    const results = await Promise.allSettled([
      verifyChallenge(options),
      verifyChallenge(options),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const other = await issueChallenge(input)
    await expect(
      verifyChallenge({
        ...options,
        id: other.id,
        event: signed(other, input.pubkey),
        resolveUser: async () => null,
      }),
    ).rejects.toThrow()
  })
})
