import { defineEventHandler, readBody, createError, setHeader } from 'h3'
import { assertCookieMutation, responseAfterLogin } from '#core/server/auth'
import { getCouchDBSettings } from '#core/server/settings'
import { COUCHDB_URL } from '#core/server/client'
export default defineEventHandler(async (event) => {
  const settings = await getCouchDBSettings(event)
  if (!settings.features.password)
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  assertCookieMutation(event)
  const body = await readBody(event)
  if (
    typeof body?.name !== 'string' ||
    !body.name.trim() ||
    typeof body?.password !== 'string' ||
    !body.password ||
    body.name.length > 512 ||
    body.password.length > 4096
  )
    throw createError({
      statusCode: 400,
      statusMessage: 'Username and password are required',
    })
  let response: Response
  try {
    response = await fetch(`${COUCHDB_URL}/_session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: body.name, password: body.password }),
      signal: AbortSignal.timeout(3000),
    })
  } catch {
    throw createError({
      statusCode: 503,
      statusMessage: 'CouchDB authentication unavailable',
    })
  }
  if (response.status === 401 || response.status === 403)
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid username or password',
    })
  if (!response.ok)
    throw createError({
      statusCode: 503,
      statusMessage: 'CouchDB authentication unavailable',
    })
  const session = await response.json()
  const token = /AuthSession=([^;]+)/.exec(
    response.headers.get('set-cookie') ?? '',
  )?.[1]
  if (!session.name || !token)
    throw createError({
      statusCode: 503,
      statusMessage: 'CouchDB did not issue a session',
    })
  setHeader(event, 'cache-control', 'no-store')
  return responseAfterLogin(
    event,
    { name: session.name, roles: session.roles ?? [] },
    token,
  )
})
