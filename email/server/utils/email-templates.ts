const PLACEHOLDER_PATTERN = /{{\s*([\w.-]+)\s*}}/g

export const EMAIL_DATABASE_NAME = 'email-sender'

/**
 * Get the email template prefix for the current app based on dbLoginPrefix
 */
export const getEmailTemplatePrefix = (dbLoginPrefix: string): string => {
  const normalizedPrefix = typeof dbLoginPrefix === 'string'
    ? dbLoginPrefix.replace(/-$/, '')
    : ''

  return `template_${normalizedPrefix}_`
}

/**
 * Get the end key for querying templates (prefix + Unicode high char)
 */
export const getEmailTemplateEndKey = (prefix: string): string => {
  return `${prefix}\uFFFF`
}

/**
 * Extract a sorted list of unique dynamic placeholders from the provided content strings.
 */
export const extractTemplatePlaceholders = (...sources: Array<string | undefined | null>): string[] => {
  const params = new Set<string>()

  for (const source of sources) {
    if (!source || typeof source !== 'string') {
      continue
    }

    let match: RegExpExecArray | null
    while ((match = PLACEHOLDER_PATTERN.exec(source)) !== null) {
      const param = match[1]?.trim()
      if (param) {
        params.add(param)
      }
    }
  }

  return Array.from(params).sort((a, b) => a.localeCompare(b))
}
