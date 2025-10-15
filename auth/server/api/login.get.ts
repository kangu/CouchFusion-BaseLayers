// Check user session and return user data if authenticated

import {defineEventHandler, createError, getHeader, setResponseHeader} from "h3"
import { getSession, getDocument } from '#database/utils/couchdb'

/**
 * Helper function to extract AuthSession cookie value from cookie header
 */
function extractAuthSessionCookie(cookieHeader: string | undefined): string | null {
    if (!cookieHeader) return null

    const cookies = cookieHeader.split(';')
    for (const cookie of cookies) {
        const trimmed = cookie.trim()
        if (trimmed.startsWith('AuthSession=')) {
            return trimmed.substring('AuthSession='.length)
        }
    }

    return null
}

export default defineEventHandler(async (event) => {
    try {
        // make sure nothing is cached
        setResponseHeader(event, 'Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
        setResponseHeader(event, 'Pragma', 'no-cache')
        setResponseHeader(event, 'Expires', '0')
        // Extract AuthSession cookie from request headers
        const cookieHeader = getHeader(event, 'cookie')
        const authSessionCookie = extractAuthSessionCookie(cookieHeader)

        if (!authSessionCookie) {
            throw createError({
                statusCode: 401,
                statusMessage: 'Authentication required: No valid session cookie found'
            })
        }

        // Get session information from CouchDB
        const sessionResponse = await getSession({authSessionCookie})

        if (!sessionResponse || !sessionResponse.userCtx?.name) {
            throw createError({
                statusCode: 401,
                statusMessage: 'Invalid or expired session'
            })
        }

        // Extract username from session
        const username = sessionResponse.userCtx.name

        // Fetch user document from _users database
        const userDocument = await getDocument('_users', `org.couchdb.user:${username}`)
        // const userDocument = await getDocumentWithAttachments('_users', `org.couchdb.user:${username}`, true)

        if (!userDocument) {
            throw createError({
                statusCode: 404,
                statusMessage: 'User document not found'
            })
        }

        // Return user data (excluding sensitive fields)
        const {_id/*, _rev*/, password_scheme, derived_key, salt, pbkdf2_prf, iterations, ...safeUserData} = userDocument

        return safeUserData
        /*    return {
              user: safeUserData,
              session: {
                username: sessionResponse.userCtx.name,
                roles: sessionResponse.userCtx.roles
              }
            }*/

    } catch (error) {
        // Re-throw if it's already a createError
        if (error.statusCode) {
            throw error
        }

        // Log unexpected errors and return generic error
        console.error('Login check error:', error)
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal server error while checking authentication'
        })
    }
})
