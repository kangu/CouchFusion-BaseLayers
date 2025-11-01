import type { H3Event } from 'h3'
import { createError, getHeader } from 'h3'
import { getSession } from '#database/utils/couchdb'

function extractAuthSessionCookie(cookieHeader: string | undefined): string | null {
    if (!cookieHeader) {
        return null
    }

    for (const part of cookieHeader.split(';')) {
        const trimmed = part.trim()
        if (trimmed.startsWith('AuthSession=')) {
            return trimmed.substring('AuthSession='.length)
        }
    }

    return null
}

/**
 * Resolve the CouchDB session for the current request and ensure the user has at least one of the required roles.
 */
export async function requireRoleSession(event: H3Event, roles: string | string[]) {
    const expectedRoles = Array.isArray(roles) ? roles : [roles]

    const cookieHeader = getHeader(event, 'cookie')
    const sessionCookie = extractAuthSessionCookie(cookieHeader)

    if (!sessionCookie) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Not found'
        })
    }

    const session = await getSession({ authSessionCookie: sessionCookie })
    const userRoles = session?.userCtx?.roles ?? []

    const hasRole = expectedRoles.some((role) => userRoles.includes(role))

    if (!hasRole) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Not found'
        })
    }

    return session
}

/**
 * Ensure the current request belongs to an admin user. Returns the session when valid.
 */
export async function requireAdminSession(event: H3Event) {
    return requireRoleSession(event, 'admin')
}

/**
 * Ensure the current request belongs to a user with the `auth` role.
 */
export async function requireAuthRoleSession(event: H3Event) {
    return requireRoleSession(event, ['auth', 'admin'])
}
