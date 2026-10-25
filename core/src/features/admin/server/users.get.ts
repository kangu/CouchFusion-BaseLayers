import { defineEventHandler } from 'h3'
import { requireAdmin } from '#core/server/auth'
import { createServiceClient } from '#core/server/client'
import { getCouchDBSettings } from '#core/server/settings'
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const settings = await getCouchDBSettings(event),
    prefix = 'org.couchdb.user:' + settings.auth.userPrefix
  const result = await createServiceClient().json<any>(
    `/_users/_all_docs?include_docs=true&startkey=${encodeURIComponent(JSON.stringify(prefix))}&endkey=${encodeURIComponent(JSON.stringify(prefix + '\ufff0'))}&limit=100`,
  )
  return {
    users: result.rows
      .filter((r: any) => r.doc?.type === 'user')
      .map((r: any) => ({ name: r.doc.name, roles: r.doc.roles ?? [] })),
  }
})
