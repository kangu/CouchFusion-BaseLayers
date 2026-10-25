import { defineEventHandler, deleteCookie, setHeader } from 'h3'
import { createCsrfToken } from '#core/server/csrf'
import { getBootstrapConfig } from '#core/server/client'
import { assertCookieMutation, sessionResponse } from '#core/server/auth'
export default defineEventHandler(async (event) => {
  assertCookieMutation(event)
  deleteCookie(event, 'AuthSession', { path: '/' })
  setHeader(event, 'cache-control', 'no-store')
  const result = await sessionResponse(event, null)
  return {
    ...result,
    csrfToken: createCsrfToken('anonymous', getBootstrapConfig().adminAuth),
  }
})
