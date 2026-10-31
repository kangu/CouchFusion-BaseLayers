import {defineEventHandler, readBody, createError} from "h3"
import { getDocument, authenticate } from '#database/utils/couchdb';
import { issueSessionCookie } from '../utils/session-cookie';

// Helper function so not to import anything external
function isValidEmail (email) {
    // simple RFC 5322-ish check — good enough for most APIs
    return typeof email === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
}

export default defineEventHandler(async (event) => {
    const body = await readBody(event)

    if (!body || typeof body.username !== 'string') {
        throw createError({
            statusCode: 400,
            statusMessage: 'Invalid input: "username" must be a string',
        })
    }

    if (!body || typeof body.password !== 'string') {
        throw createError({
            statusCode: 400,
            statusMessage: 'Invalid input: "passowrd" must be a string',
        })
    }

    const config = useRuntimeConfig()
    const dbLoginPrefix = config.dbLoginPrefix || ""

    // Try with prefix first, then without prefix
    const username = body.username.trim()
    const fullUsername = `${dbLoginPrefix}${username}`
    
    let result = await authenticate(fullUsername, body.password).catch(() => null)
    
    if (!result?.ok && username.startsWith(dbLoginPrefix) && username !== fullUsername) {
        // If prefixed version failed and original username already has prefix,
        // try the original without additional prefix
        result = await authenticate(username, body.password).catch(() => null)
    }
    
    if (!result?.ok) {
        // Try original username without prefix
        result = await authenticate(username, body.password).catch(() => null)
    }

    if (!result?.ok) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Invalid username or password',
        })
    }

    // CouchDB's own cookie lasts only its 600 s timeout; issue the layer's long-lived one.
    // A server admin may have no _users document; the helper then uses the admin salt.
    const userDoc = result.name
        ? await getDocument('_users', `org.couchdb.user:${result.name}`).catch(() => null)
        : null
    const issued = await issueSessionCookie(event, userDoc ?? (result.name ? { name: result.name } : null), config)
    if (!issued && result.setCookie) {
        console.warn('[auth] no CouchDB cookie secret available; falling back to the short CouchDB session')
        setHeader(event, 'Set-Cookie', result.setCookie)
    }

    return {success: result.ok}
})
