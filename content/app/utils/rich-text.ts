import createDOMPurify from 'dompurify'

type DOMPurifyInstance = ReturnType<typeof createDOMPurify>

const RICH_TEXT_ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  's',
  'code',
  'pre',
  'blockquote',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'span',
  'a'
] as const

const RICH_TEXT_ALLOWED_ATTRIBUTES = ['class', 'href', 'title', 'target', 'rel'] as const

const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: [...RICH_TEXT_ALLOWED_TAGS],
  ALLOWED_ATTR: [...RICH_TEXT_ALLOWED_ATTRIBUTES],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
}

let browserDomPurify: DOMPurifyInstance | null = null

const getBrowserDomPurify = (): DOMPurifyInstance | null => {
  if (typeof window === 'undefined') {
    return null
  }

  if (!browserDomPurify) {
    browserDomPurify = createDOMPurify(window as unknown as Window)
    browserDomPurify.setConfig?.(DOMPURIFY_CONFIG)
    browserDomPurify.addHook?.('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A') {
        if (!node.getAttribute('target')) {
          node.setAttribute('target', '_blank')
        }
        node.setAttribute('rel', 'noopener noreferrer')
      }
    })
  }

  return browserDomPurify
}

export const sanitizeRichTextHtml = (input: string | null | undefined): string => {
  if (!input) {
    return ''
  }

  const domPurify = getBrowserDomPurify()
  if (!domPurify) {
    // Server-side fallback: values were already sanitized client-side before persistence.
    return input
  }

  return domPurify.sanitize(input, DOMPURIFY_CONFIG) as string
}

export const getRichTextAllowedTags = () => [...RICH_TEXT_ALLOWED_TAGS]
