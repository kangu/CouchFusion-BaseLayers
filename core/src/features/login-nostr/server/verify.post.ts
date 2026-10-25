import { createError, defineEventHandler, getRequestURL, readBody } from 'h3'
import { assertCookieMutation, issueSignedSession } from '#core/server/auth'
import { getCouchDBSettings } from '#core/server/settings'
import { challengeStore, nostrBackend } from './backend'
import { verifyChallenge } from './service'
export default defineEventHandler(async (event) => {
  const settings = await getCouchDBSettings(event)
  if (!settings.features.auth || !settings.features.nostr)
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  assertCookieMutation(event)
  const body = await readBody(event)
  const backend = await nostrBackend()
  let username: string
  try {
    username = await verifyChallenge({
      store: challengeStore(settings.auth.challengeDatabase),
      appSlug: settings.appSlug,
      id: body?.id,
      event: body?.event,
      verifyUrl: getRequestURL(event).href.split('?')[0]!,
      verifySignature: backend.verifySignature,
      resolveUser: (pubkey) =>
        backend.resolveUser(pubkey, settings.auth.userPrefix),
    })
  } catch {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid or expired Nostr proof',
    })
  }
  return issueSignedSession(event, username)
})
