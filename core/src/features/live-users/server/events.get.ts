import {
  createError,
  createEventStream,
  defineEventHandler,
  setHeader,
} from 'h3'
import { requireUser } from '#core/server/auth'
import { getCouchDBSettings } from '#core/server/settings'
import { liveUsersHub } from './hub'
export default defineEventHandler(async (event) => {
  const settings = await getCouchDBSettings(event)
  if (!settings.features.liveUsers)
    throw createError({
      statusCode: 404,
      statusMessage: 'Live users is disabled',
    })
  const user = await requireUser(event)
  const stream = createEventStream(event)
  setHeader(event, 'X-Accel-Buffering', 'no')
  const unsubscribe = liveUsersHub.subscribe(user.name, (identity) => {
    void stream
      .push({ event: 'user', data: JSON.stringify(identity) })
      .catch(() => stream.close())
  })
  const heartbeat = setInterval(() => {
    void stream.push({ event: 'ping', data: '{}' }).catch(() => stream.close())
  }, 30000)
  stream.onClosed(() => {
    unsubscribe()
    clearInterval(heartbeat)
  })
  void stream
    .push({
      event: 'connected',
      data: JSON.stringify({ name: user.name, roles: user.roles }),
    })
    .catch(() => stream.close())
  return stream.send()
})
