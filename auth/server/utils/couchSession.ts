/**
 * CouchDB Session Validation Utilities
 * Validates AuthSession cookies for WebSocket authentication
 */

import {getSession} from '#database/utils/couchdb'

export interface CouchUser {
    name: string
    roles: string[]
}

/**
 * Parse Cookie header into key-value pairs
 */
function parseCookieHeader(cookieHeader = ''): Record<string, string> {
    const out: Record<string, string> = {}
    cookieHeader.split(';').forEach(kv => {
        const i = kv.indexOf('=')
        if (i > -1) {
            out[kv.slice(0, i).trim()] = decodeURIComponent(kv.slice(i + 1).trim())
        }
    })
    return out
}

/**
 * Validate CouchDB AuthSession cookie and return user info
 * Reuses existing CouchDB utilities from the database layer
 */
export async function validateCouchSession(cookieHeader?: string): Promise<CouchUser | null> {
    if (!cookieHeader) return null

    console.log('Token', cookieHeader)
    const token = cookieHeader
    // const token = parseCookieHeader(cookieHeader).AuthSession
    if (!token) return null

    try {
        // Use existing getSession utility from database layer
        const sessionResponse = await getSession({authSessionCookie: token})

        if (!sessionResponse) return null

        const user = sessionResponse.userCtx
        return user?.name ? {name: user.name, roles: user.roles || []} : null
    } catch (error) {
        console.warn('Session validation failed:', error)
        return null
    }
}
