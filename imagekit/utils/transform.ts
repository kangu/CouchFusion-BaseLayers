const TRANSFORM_PREFIX = 'tr:'
export const IMAGEKIT_TRANSFORM_PREFIX_WHITELIST = [
  'w',
  'h',
  'ar',
  'c',
  'cm',
  'fo',
  'z',
  'q',
  'f',
  'x',
  'y',
  'xc',
  'yc',
] as const
type TransformInput = string | string[] | null | undefined

const normalizeEndpoint = (endpoint?: string): string | null => {
  if (!endpoint) {
    return null
  }

  return endpoint.replace(/\/+$/, '')
}

const normalizePath = (path: string): string => path.replace(/^\/+/, '')

const SPECIAL_SCHEME_PATTERN = /^(data|blob):/i
const ABSOLUTE_URL_PATTERN = /^https?:\/\//i
const IMAGEKIT_HOST_PATTERN = /(?:^|\.)imagekit\.io$/i

const looksLikeImageKitPath = (path: string): boolean => {
  const normalized = normalizePath(path).toLowerCase()
  if (!normalized) {
    return false
  }

  if (normalized.startsWith('content-editor/')) {
    return true
  }

  return normalized.includes('updatedat=')
}

const extractHost = (value?: string): string | null => {
  if (!value) {
    return null
  }

  try {
    return new URL(value).host
  } catch {
    return null
  }
}

const matchesImageKitHost = (host: string, endpoint?: string): boolean => {
  const normalizedHost = host.toLowerCase()

  if (endpoint) {
    const endpointHost = extractHost(endpoint)
    if (endpointHost && endpointHost.toLowerCase() === normalizedHost) {
      return true
    }
  }

  return IMAGEKIT_HOST_PATTERN.test(normalizedHost)
}

type SourceClassification = 'data' | 'blob' | 'imagekit' | 'external' | 'local' | 'relative'

const classifySource = (value: string, endpoint?: string): SourceClassification => {
  const trimmed = value.trim()
  if (!trimmed) {
    return 'relative'
  }

  if (SPECIAL_SCHEME_PATTERN.test(trimmed)) {
    return trimmed.toLowerCase().startsWith('data:') ? 'data' : 'blob'
  }

  if (ABSOLUTE_URL_PATTERN.test(trimmed)) {
    const host = extractHost(trimmed)
    if (host && matchesImageKitHost(host, endpoint)) {
      return 'imagekit'
    }
    return 'external'
  }

  if (trimmed.startsWith('/')) {
    return looksLikeImageKitPath(trimmed) ? 'imagekit' : 'local'
  }

  return looksLikeImageKitPath(trimmed) ? 'imagekit' : 'relative'
}

const buildAbsoluteUrl = (source: string, endpoint?: string): string | null => {
  if (!source) {
    return null
  }

  const trimmed = source.trim()

  if (SPECIAL_SCHEME_PATTERN.test(trimmed)) {
    return trimmed
  }

  if (ABSOLUTE_URL_PATTERN.test(trimmed)) {
    return trimmed
  }

  if (trimmed.startsWith('/')) {
    return trimmed
  }

  const normalizedEndpoint = normalizeEndpoint(endpoint)
  if (!normalizedEndpoint) {
    return trimmed
  }

  return `${normalizedEndpoint}/${normalizePath(trimmed)}`
}

const splitPathSegments = (path: string): string[] =>
  normalizePath(path)
    .split('/')
    .filter(Boolean)

const stripExistingTransformSegment = (segments: string[]): string[] => {
  if (segments[0]?.startsWith(TRANSFORM_PREFIX)) {
    return segments.slice(1)
  }
  if (segments[1]?.startsWith(TRANSFORM_PREFIX)) {
    return [segments[0], ...segments.slice(2)]
  }
  return segments
}

export const normalizeTransformInput = (transformations: string | string[]): string | null => {
  if (Array.isArray(transformations)) {
    const parts = transformations.map((entry) => `${entry ?? ''}`.trim()).filter(Boolean)
    return parts.length ? parts.join(',') : null
  }

  const single = `${transformations ?? ''}`.trim()
  return single ? single : null
}

export interface TransformOptions {
  transformations: string | string[]
  endpoint?: string
}

const transformPrefix = (entry: string): string => {
  const normalized = entry.replace(/^tr:/i, '').trim()
  const separatorIndex = normalized.indexOf('-')
  if (separatorIndex === -1) {
    return normalized
  }
  return normalized.slice(0, separatorIndex)
}

const normalizeTransformEntry = (entry: string): string => entry.replace(/^tr:/i, '').trim()

export const splitImageKitTransformations = (transformations: TransformInput): string[] => {
  if (!transformations) {
    return []
  }

  if (Array.isArray(transformations)) {
    return transformations.map((entry) => normalizeTransformEntry(`${entry ?? ''}`)).filter(Boolean)
  }

  return `${transformations ?? ''}`
    .split(',')
    .map((entry) => normalizeTransformEntry(entry))
    .filter(Boolean)
}

export const sanitizeImageKitTransformations = (
  transformations: TransformInput,
  allowedPrefixes: readonly string[] = IMAGEKIT_TRANSFORM_PREFIX_WHITELIST
): string[] => {
  const allowed = new Set(allowedPrefixes.map((prefix) => `${prefix}`.trim()).filter(Boolean))
  if (!allowed.size) {
    return []
  }
  return splitImageKitTransformations(transformations).filter((entry) => allowed.has(transformPrefix(entry)))
}

export const mergeImageKitTransformations = (
  fixed: TransformInput,
  dynamic: TransformInput,
  options: { allowedPrefixes?: readonly string[] } = {}
): string | null => {
  const allowed = options.allowedPrefixes ?? IMAGEKIT_TRANSFORM_PREFIX_WHITELIST
  const base = sanitizeImageKitTransformations(fixed, allowed)
  const overrides = sanitizeImageKitTransformations(dynamic, allowed)

  if (base.length === 0 && overrides.length === 0) {
    return null
  }

  const merged = [...base]
  const indexByPrefix = new Map<string, number>()
  merged.forEach((entry, index) => {
    indexByPrefix.set(transformPrefix(entry), index)
  })

  overrides.forEach((entry) => {
    const prefix = transformPrefix(entry)
    if (indexByPrefix.has(prefix)) {
      const targetIndex = indexByPrefix.get(prefix)
      if (typeof targetIndex === 'number') {
        merged[targetIndex] = entry
      }
      return
    }
    const insertedIndex = merged.push(entry) - 1
    indexByPrefix.set(prefix, insertedIndex)
  })

  return merged.join(',')
}

export const extractImageKitTransformations = (
  source: string,
  endpoint?: string
): { source: string; transformations: string[] } => {
  const absolute = resolveAbsoluteSource(source, endpoint)
  if (!absolute) {
    return { source, transformations: [] }
  }

  const classification = classifySource(absolute, endpoint)
  if (classification !== 'imagekit') {
    return { source: absolute, transformations: [] }
  }

  const parsePath = (pathValue: string) => {
    const segments = splitPathSegments(pathValue)
    const transformIndex = segments.findIndex((segment, index) => {
      if (!segment.startsWith(TRANSFORM_PREFIX)) {
        return false
      }
      return index === 0 || index === 1
    })
    if (transformIndex === -1) {
      return {
        hasTransforms: false,
        transformedPath: pathValue,
        transformations: [] as string[],
      }
    }

    const transformSegment = segments[transformIndex]
    const transformations = splitImageKitTransformations(transformSegment.slice(TRANSFORM_PREFIX.length))
    segments.splice(transformIndex, 1)
    return {
      hasTransforms: true,
      transformedPath: `/${segments.join('/')}`,
      transformations,
    }
  }

  if (ABSOLUTE_URL_PATTERN.test(absolute)) {
    try {
      const parsed = new URL(absolute)
      const extracted = parsePath(parsed.pathname)
      if (!extracted.hasTransforms) {
        return { source: absolute, transformations: [] }
      }
      parsed.pathname = extracted.transformedPath
      return {
        source: `${parsed.origin}${parsed.pathname}${parsed.search}${parsed.hash}`,
        transformations: extracted.transformations,
      }
    } catch {
      return { source: absolute, transformations: [] }
    }
  }

  const extracted = parsePath(absolute)
  return {
    source: extracted.hasTransforms ? extracted.transformedPath : absolute,
    transformations: extracted.transformations,
  }
}

const resolveAbsoluteSource = (source: string, endpoint?: string): string | null => {
  if (!source) {
    return null
  }

  const trimmed = source.trim()
  if (!trimmed) {
    return null
  }

  const classification = classifySource(trimmed, endpoint)

  if (classification === 'data' || classification === 'blob') {
    return trimmed
  }

  if (classification === 'imagekit') {
    if (ABSOLUTE_URL_PATTERN.test(trimmed)) {
      return trimmed
    }

    const normalizedEndpoint = normalizeEndpoint(endpoint)
    if (!normalizedEndpoint) {
      return trimmed.startsWith('/') ? trimmed : `/${normalizePath(trimmed)}`
    }

    return `${normalizedEndpoint}/${normalizePath(trimmed)}`
  }

  if (ABSOLUTE_URL_PATTERN.test(trimmed) || trimmed.startsWith('/')) {
    return trimmed
  }

  return trimmed
}

export const withImageKitTransformations = (source: string, options: TransformOptions): string => {
  const absolute = resolveAbsoluteSource(source, options.endpoint)

  if (!absolute) {
    return source
  }

  const classification = classifySource(absolute, options.endpoint)
  if (classification !== 'imagekit') {
    return absolute
  }

  if (!ABSOLUTE_URL_PATTERN.test(absolute)) {
    return absolute
  }

  const transforms = normalizeTransformInput(sanitizeImageKitTransformations(options.transformations))
  if (!transforms) {
    return absolute
  }

  const url = new URL(absolute)
  const segments = stripExistingTransformSegment(splitPathSegments(url.pathname))
  const insertionIndex = segments.length > 1 ? 1 : 0
  segments.splice(insertionIndex, 0, `${TRANSFORM_PREFIX}${transforms}`)
  const pathWithTransform = segments.join('/')

  return `${url.origin}/${pathWithTransform}${url.search}${url.hash}`
}

export const resolveImageKitUrl = (source: string, endpoint?: string): string => {
  return resolveAbsoluteSource(source, endpoint) ?? source
}
