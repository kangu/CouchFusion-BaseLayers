const PLACEHOLDER_PATTERN = /{{\s*([\w.-]+)\s*}}/g
const INLINE_DYNAMIC_PATTERN = /{{\s*[\w.-]+\s*}}/g
const MJ_STYLE_BLOCK_PATTERN = /<mj-style\b[^>]*>[\s\S]*?<\/mj-style>/gi

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

export interface MjmlTextExtractionResult {
  texts: string[]
  transformedMjml: string
  hrefLinks: MjmlHrefLink[]
}

export interface MjmlHrefLink {
  textPlaceholder: string
  hrefPlaceholder: string
  href: string
  tagName: string
}

interface TextRange {
  start: number
  end: number
}

const hasAlphaNumeric = (value: string): boolean => {
  return /[\p{L}\p{N}]/u.test(value)
}

const slugifyText = (value: string): string => {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'text'
}

const buildUniqueSlug = (baseSlug: string, counters: Map<string, number>): string => {
  const currentCount = counters.get(baseSlug) ?? 0
  const nextCount = currentCount + 1
  counters.set(baseSlug, nextCount)

  if (nextCount === 1) {
    return baseSlug
  }

  return `${baseSlug}-${nextCount}`
}

const replaceChunkWithPlaceholder = (
  chunk: string,
  extractedTexts: string[],
  slugCounters: Map<string, number>
): string => {
  if (!chunk.trim()) {
    return chunk
  }

  const trimmedChunk = chunk.trim()
  if (!hasAlphaNumeric(trimmedChunk)) {
    return chunk
  }

  const baseSlug = slugifyText(trimmedChunk)
  const uniqueSlug = buildUniqueSlug(baseSlug, slugCounters)
  extractedTexts.push(trimmedChunk)

  const leadingWhitespaceLength = chunk.length - chunk.trimStart().length
  const trailingWhitespaceLength = chunk.length - chunk.trimEnd().length
  const leadingWhitespace = chunk.slice(0, leadingWhitespaceLength)
  const trailingWhitespace = trailingWhitespaceLength > 0
    ? chunk.slice(chunk.length - trailingWhitespaceLength)
    : ''

  return `${leadingWhitespace}[${uniqueSlug}]${trailingWhitespace}`
}

const collectMjStyleRanges = (mjml: string): TextRange[] => {
  const ranges: TextRange[] = []
  let match: RegExpExecArray | null

  MJ_STYLE_BLOCK_PATTERN.lastIndex = 0
  while ((match = MJ_STYLE_BLOCK_PATTERN.exec(mjml)) !== null) {
    ranges.push({
      start: match.index,
      end: match.index + match[0].length
    })
  }

  return ranges
}

const isInsideRanges = (index: number, ranges: TextRange[]): boolean => {
  for (const range of ranges) {
    if (index >= range.start && index < range.end) {
      return true
    }
  }

  return false
}

/**
 * Extract editable text fragments from raw MJML and replace each extracted text
 * with a distinct non-dynamic placeholder in the transformed markup.
 */
export const extractEditableMjmlTexts = (mjml: string): MjmlTextExtractionResult => {
  if (typeof mjml !== 'string' || !mjml.length) {
    return {
      texts: [],
      transformedMjml: typeof mjml === 'string' ? mjml : '',
      hrefLinks: []
    }
  }

  const extractedTexts: string[] = []
  const slugCounters = new Map<string, number>()
  const mjStyleRanges = collectMjStyleRanges(mjml)

  const transformedTextMjml = mjml.replace(/>([^<]+)</g, (_fullMatch, rawNodeText: string, offset: number) => {
    if (isInsideRanges(offset, mjStyleRanges)) {
      return `>${rawNodeText}<`
    }

    if (typeof rawNodeText !== 'string' || !rawNodeText.trim()) {
      return `>${rawNodeText}<`
    }

    let cursor = 0
    let transformedNodeText = ''
    let dynamicMatch: RegExpExecArray | null

    INLINE_DYNAMIC_PATTERN.lastIndex = 0

    while ((dynamicMatch = INLINE_DYNAMIC_PATTERN.exec(rawNodeText)) !== null) {
      const staticChunk = rawNodeText.slice(cursor, dynamicMatch.index)
      transformedNodeText += replaceChunkWithPlaceholder(staticChunk, extractedTexts, slugCounters)
      transformedNodeText += dynamicMatch[0]
      cursor = dynamicMatch.index + dynamicMatch[0].length
    }

    transformedNodeText += replaceChunkWithPlaceholder(rawNodeText.slice(cursor), extractedTexts, slugCounters)

    return `>${transformedNodeText}<`
  })

  const hrefLinks: MjmlHrefLink[] = []
  const hrefPlaceholderCounters = new Map<string, number>()

  const transformedMjml = transformedTextMjml.replace(
    /<([a-z0-9-]+)\b([^>]*)\bhref=(["'])(.*?)\3([^>]*)>([\s\S]*?)<\/\1>/gi,
    (fullMatch, tagName: string, beforeHref: string, quote: string, hrefValue: string, afterHref: string, innerContent: string) => {
      if (!hrefValue || hrefValue.includes('{{')) {
        return fullMatch
      }

      const placeholderMatch = /\[([a-z0-9-]+)\]/i.exec(innerContent)
      const textPlaceholder = placeholderMatch?.[1]?.trim()
      if (!textPlaceholder) {
        return fullMatch
      }

      const hrefBaseSlug = `${textPlaceholder}-href`
      const hrefPlaceholder = buildUniqueSlug(hrefBaseSlug, hrefPlaceholderCounters)

      hrefLinks.push({
        textPlaceholder,
        hrefPlaceholder,
        href: hrefValue,
        tagName: tagName.toLowerCase()
      })

      const replacedHref = `[${hrefPlaceholder}]`
      return `<${tagName}${beforeHref}href=${quote}${replacedHref}${quote}${afterHref}>${innerContent}</${tagName}>`
    }
  )

  return {
    texts: extractedTexts,
    transformedMjml,
    hrefLinks
  }
}
