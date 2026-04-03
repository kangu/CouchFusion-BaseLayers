export type InlinePreviewPropHint = {
  text?: string
  href?: string
  src?: string
  alt?: string
  ariaLabel?: string
  title?: string
}

type MatchCandidate = {
  value: string
  kind: 'href' | 'src' | 'alt' | 'ariaLabel' | 'title' | 'text'
}

const normalizeValue = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null
  }
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

const toCandidates = (hint: InlinePreviewPropHint): MatchCandidate[] => {
  const ordered: Array<[MatchCandidate['kind'], unknown]> = [
    ['href', hint.href],
    ['src', hint.src],
    ['alt', hint.alt],
    ['ariaLabel', hint.ariaLabel],
    ['title', hint.title],
    ['text', hint.text]
  ]

  const result: MatchCandidate[] = []
  for (const [kind, raw] of ordered) {
    const value = normalizeValue(raw)
    if (value) {
      result.push({ kind, value })
    }
  }
  return result
}

const isObjectRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const doesStringMatch = (candidate: MatchCandidate, value: string): boolean => {
  const normalized = value.trim()
  if (!normalized) {
    return false
  }

  // URL-ish and semantic attributes should match exactly.
  if (candidate.kind !== 'text') {
    return normalized === candidate.value
  }

  if (normalized === candidate.value) {
    return true
  }

  // Allow loose text match to survive punctuation/newline normalization.
  return (
    normalized.includes(candidate.value) ||
    candidate.value.includes(normalized)
  )
}

const searchForCandidate = (
  value: unknown,
  candidate: MatchCandidate,
  currentPath: Array<string | number> = []
): Array<string | number> | null => {
  if (typeof value === 'string') {
    return doesStringMatch(candidate, value) ? currentPath : null
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const match = searchForCandidate(value[index], candidate, [...currentPath, index])
      if (match) {
        return match
      }
    }
    return null
  }

  if (isObjectRecord(value)) {
    for (const [key, nested] of Object.entries(value)) {
      const match = searchForCandidate(nested, candidate, [...currentPath, key])
      if (match) {
        return match
      }
    }
  }

  return null
}

export const inferPropPathFromPreviewHint = (
  props: Record<string, any> | null | undefined,
  hint: InlinePreviewPropHint | null | undefined
): Array<string | number> | null => {
  if (!props || typeof props !== 'object' || !hint) {
    return null
  }

  const candidates = toCandidates(hint)
  if (!candidates.length) {
    return null
  }

  for (const candidate of candidates) {
    const match = searchForCandidate(props, candidate)
    if (match && match.length) {
      return match
    }
  }

  return null
}
