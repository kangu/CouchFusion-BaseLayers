import type { H3Event } from 'h3'
import { createError, getHeader } from 'h3'
import { getDocument, getSession } from '#database/utils/couchdb'

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
 * Loads current application roles from the CouchDB user document after the
 * session identity has already been validated.
 */
async function getCurrentUserDocumentRoles(username: string | null | undefined): Promise<string[]> {
    if (!username) {
        return []
    }

    try {
        const userDocument = await getDocument<{ roles?: unknown }>(
            '_users',
            `org.couchdb.user:${username}`
        )

        return Array.isArray(userDocument?.roles)
            ? userDocument.roles.filter((role): role is string => typeof role === 'string')
            : []
    } catch {
        return []
    }
}

const getSessionRoles = async (sessionCookie: string) => {
    const session = await getSession({ authSessionCookie: sessionCookie })
    const sessionRoles = session?.userCtx?.roles ?? []
    const documentRoles = await getCurrentUserDocumentRoles(session?.userCtx?.name)
    const roles = [...new Set([...sessionRoles, ...documentRoles])]

    return {
        session,
        roles,
    }
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

    const { session, roles: userRoles } = await getSessionRoles(sessionCookie)

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
    return requireRoleSession(event, ['admin', '_admin'])
}

/**
 * Ensure the current request belongs to a content editor.
 */
export async function requireContentEditorSession(event: H3Event) {
    return requireRoleSession(event, ['admin', '_admin', 'editor'])
}

/**
 * Resolve an optional content editor session for public endpoints that should
 * continue serving anonymous published content.
 */
export async function resolveContentEditorSession(event: H3Event) {
    const cookieHeader = getHeader(event, 'cookie')
    const sessionCookie = extractAuthSessionCookie(cookieHeader)

    if (!sessionCookie) {
        return null
    }

    try {
        const { session, roles } = await getSessionRoles(sessionCookie)
        const canEditContent = ['admin', '_admin', 'editor'].some((role) => roles.includes(role))
        return canEditContent ? session : null
    } catch {
        return null
    }
}

/**
 * Ensure the current request belongs to a user with the `auth` role.
 */
export async function requireAuthRoleSession(event: H3Event) {
    return requireRoleSession(event, ['auth', 'admin'])
}
