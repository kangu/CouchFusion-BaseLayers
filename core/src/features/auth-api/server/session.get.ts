import { defineEventHandler, setHeader } from 'h3'
import { sessionResponse } from '#core/server/auth'
export default defineEventHandler(async (event) => {
  setHeader(event, 'cache-control', 'no-store')
  return sessionResponse(event)
})
