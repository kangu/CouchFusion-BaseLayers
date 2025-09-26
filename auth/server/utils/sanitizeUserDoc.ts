/**
 * User Document Sanitization
 * Removes sensitive fields from user documents before sending over WebSocket
 */

/**
 * Sanitized user document structure safe for client consumption
 */
export interface SanitizedUserDoc {
    _id: string
    _rev: string
    name: string
    roles: string[]
    email?: string
    profile?: {
        displayName?: string
        avatar?: string
        [key: string]: any
    }

    [key: string]: any // Allow other safe fields
}

/**
 * Fields that should NEVER be sent to clients
 * These contain sensitive authentication data
 */
const SENSITIVE_FIELDS = [
    '_id',
    '_rev',
    'password',
    'derived_key',
    'password_scheme',
    'iterations',
    'salt',
    'pbkdf2_prf',
    'password_sha'
]

/**
 * Sanitize a user document by removing sensitive authentication fields
 * Returns null if the document is invalid or missing required fields
 */
export function sanitizeUserDoc(doc: any): SanitizedUserDoc | null {
    if (!doc || typeof doc !== 'object') {
        return null
    }

    // Must have basic required fields
    if (!doc._id || !doc.name) {
        return null
    }

    // Create a copy and remove sensitive fields
    const sanitized = {...doc}

    // Remove all sensitive authentication fields
    for (const field of SENSITIVE_FIELDS) {
        delete sanitized[field]
    }

    // Ensure roles is always an array
    if (!Array.isArray(sanitized.roles)) {
        sanitized.roles = []
    }

    // Ensure basic structure
    const result: SanitizedUserDoc = {
        _id: sanitized._id,
        _rev: sanitized._rev,
        name: sanitized.name,
        roles: sanitized.roles,
        ...sanitized
    }

    // Clean up profile object if it exists
    if (result.profile && typeof result.profile === 'object') {
        result.profile = {
            displayName: result.profile.displayName,
            avatar: result.profile.avatar,
            ...result.profile
        }
    }

    return result
}
