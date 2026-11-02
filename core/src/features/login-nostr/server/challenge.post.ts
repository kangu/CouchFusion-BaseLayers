import { createError, defineEventHandler, getRequestURL, readBody } from 'h3'
import { assertCookieMutation } from '#core/server/auth'
import { getCouchDBSettings } from '#core/server/settings'
import { challengeStore, nostrBackend } from './backend'
import { issueChallenge } from './service'
import { createServiceClient } from '#core/server/client'
import { createProofOfWorkService } from '../../proof-of-work/server/service'
export default defineEventHandler(async (event) => {
  const settings = await getCouchDBSettings(event)
  if (!settings.features.auth || !settings.features.nostr)
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  assertCookieMutation(event)
  const body = await readBody(event)
  if (settings.features.proofOfWork)
    await createProofOfWorkService({
      client: createServiceClient(),
      database: settings.auth.challengeDatabase,
      bits: settings.auth.proofOfWorkBits,
      ttlSeconds: settings.auth.proofOfWorkTtlSeconds,
    }).consume(body?.proof?.challengeId, body?.proof?.nonce)
  const backend = await nostrBackend()
  try {
    const pubkey = backend.normalize(body?.pubkey ?? body?.npub)
    const verifyUrl = new URL(
      '/api/couchdb/login/nostr/verify',
      getRequestURL(event).origin,
    ).href
    return await issueChallenge({
      store: challengeStore(settings.auth.challengeDatabase),
      appSlug: settings.appSlug,
      pubkey,
      verifyUrl,
    })
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Unable to issue Nostr challenge',
    })
  }
})
