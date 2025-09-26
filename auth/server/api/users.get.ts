import { defineEventHandler, createError, getHeader } from "h3"
import { getAllDocs, getSession } from '#database/utils/couchdb'

const extractAuthSessionCookie = (cookieHeader: string | undefined): string | null => {
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

export default defineEventHandler(async (event) => {
  try {
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

    // Get runtime configuration
    const config = useRuntimeConfig()
    const dbLoginPrefix = config.dbLoginPrefix

    // Validate required runtime config
    if (!dbLoginPrefix) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Server configuration error: dbLoginPrefix is required but not configured'
      })
    }

    // Construct key range for filtering users by prefix
    // CouchDB user documents have IDs like: org.couchdb.user:username
    const startkey = `org.couchdb.user:${dbLoginPrefix}`
    const endkey = `org.couchdb.user:${dbLoginPrefix}\uFFFF`

    console.log(`Querying users with prefix: ${dbLoginPrefix}`)
    console.log(`Key range: ${startkey} to ${endkey}`)

    // Query _users database with key range filtering
    const result = await getAllDocs('_users', {
      startkey,
      endkey,
      include_docs: true
    })

    if (!result) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Users database not found or not accessible'
      })
    }

    // Filter and transform user data to remove sensitive information
    const users = result.rows.map(row => {
      const doc = row.doc
      if (!doc) return null

      // Remove sensitive fields and return all other fields by default
      const { _rev, password, password_scheme, derived_key, salt, pbkdf2_prf, iterations, ...safeUserData } = doc

      return safeUserData
    }).filter(user => user !== null) // Remove null entries

    console.log(`Found ${users.length} users with prefix: ${dbLoginPrefix}`)

    return {
      success: true,
      users,
      total: users.length,
      prefix: dbLoginPrefix
    }

  } catch (error: any) {
    console.error('Users API error:', error)

    // Re-throw if it's already a createError
    if (error.statusCode) {
      throw error
    }

    // Handle CouchDB-specific errors
    if (error.message?.includes('CouchDB')) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Database query failed'
      })
    }

    // Generic error response
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})
