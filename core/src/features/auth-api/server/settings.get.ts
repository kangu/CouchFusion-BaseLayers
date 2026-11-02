import { defineEventHandler, setHeader } from 'h3'
import { publicSettings } from '#core/options'
import { getCouchDBSettings } from '#core/server/settings'
export default defineEventHandler(async (event) => {
  setHeader(event, 'cache-control', 'no-store')
  return publicSettings(await getCouchDBSettings(event))
})
