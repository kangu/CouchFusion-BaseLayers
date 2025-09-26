import {defineEventHandler, readBody, createError} from "h3"
import { getDocument, putDocument, getView, createUser, authenticate, getSession, generateAuthSessionCookie } from '#database/utils/couchdb';

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

    const result = await authenticate(body.username, body.password)
    if (result.setCookie) {
        // console.log('Setting cookie')
        setHeader(event, 'Set-Cookie', result.setCookie)
    }
    // console.log('Result auth', result)

    return {success: result.ok}
})
