import { createError, defineEventHandler, readBody } from 'h3'
import { getCouchDBSettings } from '#core/server/settings'
import { assertCookieMutation, issueSignedSession } from '#core/server/auth'
import { createServiceClient } from '#core/server/client'
import deliver from '#core-email-delivery'
import { createEmailLoginService } from './service'
export default defineEventHandler(async (event) => {
  await assertCookieMutation(event)
  const settings = await getCouchDBSettings(event)
  if (!settings.features.auth || !settings.features.email)
    throw createError({ statusCode: 404 })
  const body = await readBody(event)
  const username = await createEmailLoginService({
    client: createServiceClient(),
    database: settings.auth.tokenDatabase,
    userPrefix: settings.auth.userPrefix,
    ttlSeconds: settings.auth.tokenTtlSeconds,
    appSlug: settings.appSlug,
    deliver,
  }).verify(body?.email, body?.code)
  return issueSignedSession(event, username)
})
