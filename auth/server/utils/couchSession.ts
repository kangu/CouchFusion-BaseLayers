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
 * Validate CouchDB AuthSession cookie and return user info
 * Reuses existing CouchDB utilities from the database layer
 */
export async function validateCouchSession(cookieHeader?: string): Promise<CouchUser | null> {
    if (!cookieHeader) return null

    console.log('Token', cookieHeader)
    const token = cookieHeader
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
