import { createError, defineEventHandler } from 'h3'
import { getCouchDBSettings } from '#core/server/settings'
import { assertCookieMutation } from '#core/server/auth'
import { createServiceClient } from '#core/server/client'
import { createProofOfWorkService } from './service'
export default defineEventHandler(async (event) => {
  await assertCookieMutation(event)
  const settings = await getCouchDBSettings(event)
  if (!settings.features.auth || !settings.features.proofOfWork)
    throw createError({ statusCode: 404 })
  return createProofOfWorkService({
    client: createServiceClient(),
    database: settings.auth.challengeDatabase,
    bits: settings.auth.proofOfWorkBits,
    ttlSeconds: settings.auth.proofOfWorkTtlSeconds,
  }).challenge()
})
