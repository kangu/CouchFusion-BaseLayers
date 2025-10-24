const TRANSFORM_PREFIX = 'tr:'

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

  const transforms = normalizeTransformInput(options.transformations)
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
