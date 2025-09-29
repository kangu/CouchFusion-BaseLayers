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
 * Ensure the current request belongs to an admin user. Returns the session when valid.
 */
export async function requireAdminSession(event: H3Event) {
    const cookieHeader = getHeader(event, 'cookie')
    const sessionCookie = extractAuthSessionCookie(cookieHeader)

    if (!sessionCookie) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Not found'
        })
    }

    const session = await getSession({ authSessionCookie: sessionCookie })

    if (!session?.userCtx?.roles?.includes('admin')) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Not found'
        })
    }

    return session
}
