import { defineEventHandler, readBody, createError } from 'h3'
import useIds from '../../../app/composables/useIds'
import { bulkDocs, getView } from '#database/utils/couchdb'

interface ImportUserProfile {
  full_name?: string
  telegram_handle?: string
  linkedin_url?: string
  referral_source?: string
  comments?: string
  [key: string]: unknown
}

interface ImportUserRow {
  email?: string
  roles?: string[]
  profile?: ImportUserProfile
  pow_lab_status?: string | null
  pow_lab_valid_until?: string | null
  pow_lab_lite_status?: string | null
  pow_lab_lite_valid_until?: string | null
  referred_by?: string | null
  funnel?: string | null
  [key: string]: unknown
}

interface ImportPayload {
  rows: ImportUserRow[]
}

export default defineEventHandler(async (event) => {
  const body = await readBody<ImportPayload | null>(event)

  if (!body || !Array.isArray(body.rows) || body.rows.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid payload: rows must be a non-empty array'
    })
  }

  const runtimeConfig = useRuntimeConfig()
  const dbLoginPrefix = runtimeConfig.dbLoginPrefix

  if (!dbLoginPrefix) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Server configuration error: dbLoginPrefix missing'
    })
  }

  const { randomId } = useIds()

  const emails = body.rows
    .map((row) => (typeof row.email === 'string' ? row.email.trim().toLowerCase() : ''))
    .filter(email => email.length > 0)

  if (emails.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No valid emails found in import payload'
    })
  }

  const existingEmails = new Set<string>()

  const existing = await getView('_users', 'auth', 'has_account', {
    keys: emails,
    include_docs: false
  })

  if (existing?.rows?.length) {
    for (const row of existing.rows) {
      if (typeof row.key === 'string') {
        existingEmails.add(row.key.toLowerCase())
      }
    }
  }

  const documents = []
  const skipped: string[] = []

  for (const row of body.rows) {
    const email = typeof row.email === 'string' ? row.email.trim() : ''

    if (!email || existingEmails.has(email.toLowerCase())) {
      if (email) {
        skipped.push(email)
      }
      continue
    }

    const username = `${dbLoginPrefix}${randomId(8)}`
    const password = randomId(16)

    const doc: Record<string, unknown> = {
      _id: `org.couchdb.user:${username}`,
      name: username,
      type: 'user',
      roles: Array.isArray(row.roles) ? row.roles : [],
      email,
      password
    }

    if (row.profile && typeof row.profile === 'object') {
      const profile: Record<string, unknown> = {}

      for (const [key, value] of Object.entries(row.profile)) {
        if (typeof value === 'string') {
          const trimmed = value.trim()
          if (trimmed.length > 0) {
            profile[key] = trimmed
          }
        } else if (value !== null && value !== undefined) {
          profile[key] = value
        }
      }

      if (Object.keys(profile).length > 0) {
        doc.profile = profile
      }
    }

    const optionalStringFields: Array<keyof ImportUserRow> = [
      'pow_lab_status',
      'pow_lab_valid_until',
      'pow_lab_lite_status',
      'pow_lab_lite_valid_until',
      'referred_by',
      'funnel'
    ]

    for (const field of optionalStringFields) {
      const value = row[field]
      if (typeof value === 'string' && value.trim().length > 0) {
        doc[field] = value.trim()
      }
    }

    documents.push(doc)
  }

  if (documents.length === 0) {
    return {
      success: true,
      imported: 0,
      skipped,
      results: []
    }
  }

  const results = await bulkDocs('_users', documents)

  return {
    success: true,
    imported: results.filter(result => result.ok).length,
    skipped,
    results
  }
})
