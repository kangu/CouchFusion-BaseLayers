import { randomBytes } from 'node:crypto'
export interface NostrLoginEvent {
  id: string
  sig: string
  pubkey: string
  kind: number
  created_at: number
  content: string
  tags: string[][]
}
export interface NostrChallenge {
  _id: string
  _rev?: string
  type: 'nostr-login'
  appSlug: string
  pubkey: string
  message: string
  verifyUrl: string
  issuedAt: number
  expiresAt: number
  consumedAt?: number
}
export interface ChallengeStore {
  create(record: NostrChallenge): Promise<void>
  get(id: string): Promise<NostrChallenge | null>
  consume(record: NostrChallenge): Promise<void>
}
interface ChallengeOptions {
  store: ChallengeStore
  appSlug: string
  pubkey: string
  verifyUrl: string
  now?: number
}
export async function issueChallenge(options: ChallengeOptions) {
  if (!/^[a-f0-9]{64}$/.test(options.pubkey))
    throw new Error('Invalid Nostr public key')
  const now = options.now ?? Date.now()
  const id = `nostr:${randomBytes(32).toString('hex')}`
  const expiresAt = now + 300000
  const message = `nostr-login:${options.appSlug}:${randomBytes(32).toString('hex')}:${expiresAt}`
  await options.store.create({
    _id: id,
    type: 'nostr-login',
    appSlug: options.appSlug,
    pubkey: options.pubkey,
    verifyUrl: options.verifyUrl,
    issuedAt: now,
    expiresAt,
    message,
  })
  return { id, message, expiresAt }
}
export async function verifyChallenge(
  options: Omit<ChallengeOptions, 'pubkey'> & {
    id: string
    event: unknown
    verifySignature(event: NostrLoginEvent): boolean
    resolveUser(pubkey: string): Promise<string | null>
  },
): Promise<string> {
  if (!/^nostr:[a-f0-9]{64}$/.test(options.id))
    throw new Error('Invalid challenge')
  const record = await options.store.get(options.id)
  const now = options.now ?? Date.now()
  if (
    !record ||
    record.type !== 'nostr-login' ||
    record.appSlug !== options.appSlug ||
    record.consumedAt !== undefined ||
    record.expiresAt <= now ||
    record.issuedAt > now ||
    record.verifyUrl !== options.verifyUrl
  )
    throw new Error('Invalid or expired challenge')
  const event = options.event as NostrLoginEvent | undefined
  if (
    !event ||
    event.kind !== 27235 ||
    event.pubkey !== record.pubkey ||
    event.content !== record.message ||
    !Number.isInteger(event.created_at) ||
    event.created_at * 1000 < record.issuedAt - 30000 ||
    event.created_at * 1000 > now + 30000 ||
    !Array.isArray(event.tags)
  )
    throw new Error('Invalid signed challenge')
  for (const [name, value] of [
    ['challenge', record.message],
    ['u', record.verifyUrl],
    ['method', 'POST'],
  ]) {
    const tags = event.tags.filter(
      (tag) => Array.isArray(tag) && tag[0] === name,
    )
    if (tags.length !== 1 || tags[0]?.length !== 2 || tags[0]?.[1] !== value)
      throw new Error('Invalid signed tags')
  }
  if (!options.verifySignature(event))
    throw new Error('Invalid Nostr signature')
  const username = await options.resolveUser(record.pubkey)
  if (!username) throw new Error('No linked account')
  // CouchDB revision compare-and-swap is the replay boundary across all workers.
  await options.store.consume({ ...record, consumedAt: now })
  return username
}
