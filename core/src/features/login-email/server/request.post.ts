import { createError, defineEventHandler, readBody } from 'h3'
import { getCouchDBSettings } from '#core/server/settings'
import { assertCookieMutation } from '#core/server/auth'
import { createServiceClient } from '#core/server/client'
import deliver from '#core-email-delivery'
import { createEmailLoginService } from './service'
import { createProofOfWorkService } from '../../proof-of-work/server/service'
export default defineEventHandler(async (event) => {
  await assertCookieMutation(event)
  const settings = await getCouchDBSettings(event)
  if (!settings.features.auth || !settings.features.email)
    throw createError({ statusCode: 404 })
  const body = await readBody(event),
    client = createServiceClient()
  if (settings.features.proofOfWork)
    await createProofOfWorkService({
      client,
      database: settings.auth.challengeDatabase,
      bits: settings.auth.proofOfWorkBits,
      ttlSeconds: settings.auth.proofOfWorkTtlSeconds,
    }).consume(body?.proof?.challengeId, body?.proof?.nonce)
  return createEmailLoginService({
    client,
    database: settings.auth.tokenDatabase,
    userPrefix: settings.auth.userPrefix,
    ttlSeconds: settings.auth.tokenTtlSeconds,
    appSlug: settings.appSlug,
    deliver,
  }).request(body?.email)
})
