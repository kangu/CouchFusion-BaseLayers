// Checks to see if the provided login token is valid

import {defineEventHandler, readBody, createError, setHeader} from "h3"
import useIds from "../../app/composables/useIds";
import { getDocument, putDocument, getView, createUser, authenticate, getSession, generateAuthSessionCookie } from '#database/utils/couchdb';

// Helper function so not to import anything external
function isValidEmail (email) {
    // simple RFC 5322-ish check — good enough for most APIs
    return typeof email === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
}

// Checks expiration date and if it's not used
function isNotExpired (tokenDoc) {
    if (!tokenDoc || !tokenDoc.expires || tokenDoc.used) { return false }
    const currentTime = new Date()
    const expirationTime = new Date(tokenDoc.expires)
    return currentTime < expirationTime
}

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const runtimeConfig = useRuntimeConfig()

    // Validate cookie secret is available
    if (!runtimeConfig.couchdbCookieSecret) {
        throw createError({
            statusCode: 500,
            statusMessage: 'CouchDB cookie secret not configured'
        })
    }

    //
    // Validation
    //
    if (!body || !isValidEmail(body.email)) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Invalid input: "email" must be an email address',
        })
    }
    if (!body || typeof body.token !== 'string') {
        throw createError({
            statusCode: 400,
            statusMessage: 'Invalid input: "token" must be a string',
        })
    }

    // get couch
    const config = useRuntimeConfig()
    const dbLoginPrefix = config.dbLoginPrefix;
    const { randomId } = useIds()
    const DB = `${dbLoginPrefix}-logins`

    try {
        // Get the login token document using authenticated CouchDB request
        const tokenDocId = `${body.email}--${body.token}`
        const resp = await getDocument(DB, tokenDocId)

        // if resp is null, document doesn't exist (invalid token)
        if (!resp) {
            throw createError({
                statusCode: 404,
                statusMessage: "Invalid login"
            })
        }

        // if resp is valid, it means we get the document
        // check expiration and usage
        if (!isNotExpired(resp)) {
            throw createError({
                statusCode: 404,
                statusMessage: "Invalid login"
            })
        }

        // check to see if email is new or existing
        // use design document
        // generate random id for new users
        const existingDocs = await getView('_users', 'auth', 'has_account', {
            key: body.email
        })
        console.log('Existing docs:', existingDocs.rows)

        const affiliateFriendCode = typeof resp.affiliate_friend_code === 'string'
            ? resp.affiliate_friend_code
            : undefined

        let userDoc = {}
        let newCookie = ''
        // new user
        if (existingDocs.rows.length === 0) {
            // create _users document with random id and body.email
            const userName = config.dbLoginPrefix + randomId(8)
            const userPayload: Record<string, unknown> = {
                email: body.email,
                funnel: resp.funnel
            }

            if (affiliateFriendCode) {
                userPayload.referred_by = affiliateFriendCode
            }

            const userResult = await createUser(userName, randomId(), userPayload)
            if (userResult.ok) {
                userDoc = await getDocument('_users', 'org.couchdb.user:' + userName)
            }
        } else {
            // existing user
            userDoc = existingDocs.rows[0].value
        }
        newCookie = generateAuthSessionCookie(userDoc.name, runtimeConfig.couchdbCookieSecret, userDoc.salt, 6000000)
        setHeader(event, 'Set-Cookie', newCookie);
        const sessionDoc = await getSession({authSessionCookie: newCookie})
        console.log('Session doc', sessionDoc)

        // mark token as used
        resp.used = true
        const tokenUpdateResp = await putDocument(DB, resp)
        console.log('Token update', tokenUpdateResp)

        return {
            resp,
            doc: userDoc
            // cookie: newCookie
        }
    } catch (e) {
        // Re-throw if it's already a createError
        if (e.statusCode) {
            throw e
        }
        // Otherwise, treat as invalid login
        throw createError({
            statusCode: 404,
            statusMessage: "Invalid login"
        })
    }
})
