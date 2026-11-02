import { defineEventHandler, setHeader } from 'h3'
import { createCsrfToken } from '#core/server/csrf'
import { getBootstrapConfig } from '#core/server/client'
import {
  assertCookieMutation,
  clearSessionCookies,
  sessionResponse,
} from '#core/server/auth'
export default defineEventHandler(async (event) => {
  assertCookieMutation(event)
  // Ends both the native session and the remembered login on this browser.
  clearSessionCookies(event)
  setHeader(event, 'cache-control', 'no-store')
  const result = await sessionResponse(event, null)
  return {
    ...result,
    csrfToken: createCsrfToken('anonymous', getBootstrapConfig().adminAuth),
  }
})
