const TRANSFORM_PREFIX = 'tr:'

const normalizeEndpoint = (endpoint?: string): string | null => {
  if (!endpoint) {
    return null
  }

  return endpoint.replace(/\/+$/, '')
}

const normalizePath = (path: string): string => path.replace(/^\/+/, '')

const buildAbsoluteUrl = (source: string, endpoint?: string): string | null => {
  if (!source) {
    return null
  }

  if (/^https?:\/\//i.test(source)) {
    return source
  }

  const normalizedEndpoint = normalizeEndpoint(endpoint)
  if (!normalizedEndpoint) {
    return null
  }

  return `${normalizedEndpoint}/${normalizePath(source)}`
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

export const withImageKitTransformations = (source: string, options: TransformOptions): string => {
  const absolute = buildAbsoluteUrl(source, options.endpoint)

  if (!absolute) {
    return source
  }

  const transforms = normalizeTransformInput(options.transformations)
  if (!transforms) {
    return absolute
  }

  const url = new URL(absolute)
  const segments = stripExistingTransformSegment(splitPathSegments(url.pathname))
  const insertionIndex = segments.length >= 1 ? 1 : 0
  segments.splice(insertionIndex, 0, `${TRANSFORM_PREFIX}${transforms}`)
  const pathWithTransform = segments.join('/')

  return `${url.origin}/${pathWithTransform}${url.search}${url.hash}`
}

export const resolveImageKitUrl = (source: string, endpoint?: string): string => {
  return buildAbsoluteUrl(source, endpoint) ?? source
}
