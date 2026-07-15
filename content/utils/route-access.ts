import type { ContentRouteAccessPolicy } from '#content/types/content-page'
import { RESERVED_CONTENT_PREFIXES } from '#content/utils/content-route'

export type { ContentRouteAccessPolicy } from '#content/types/content-page'

export type ParsedContentRouteAccessPolicy =
  | { status: 'public' }
  | { status: 'valid'; policy: ContentRouteAccessPolicy }
  | { status: 'invalid'; reason: string }

export type ContentRouteAccessAction =
  | { type: 'allow'; grantSession: boolean }
  | { type: 'redirect'; to: string }

/**
 * Returns whether an otherwise ignored route may own content-page access metadata.
 * Reserved application routes and asset-like paths must never trigger a page lookup.
 */
export const canResolveContentRouteAccessForPath = (path: string): boolean => {
  const normalized = normalizeContentRoutePath(path)
  if (!normalized) {
    return false
  }

  if (RESERVED_CONTENT_PREFIXES.some(prefix => normalized.startsWith(prefix))) {
    return false
  }

  const lastSegment = normalized.split('/').pop() ?? ''
  return normalized === '/' || (lastSegment.length > 0 && !lastSegment.includes('.'))
}

/** Reads an exact route-access session marker from a Cookie request header. */
export const hasContentRouteAccessSessionCookie = (
  cookieHeader: string | null | undefined,
  cookieName: string,
): boolean => {
  if (!cookieHeader || !cookieName) {
    return false
  }

  return cookieHeader
    .split(';')
    .some(part => part.trim() === `${cookieName}=1`)
}

/** Recognizes the content builder's established public-route iframe marker. */
export const isContentRouteAccessEditorPreview = (query: unknown): boolean => {
  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    return false
  }

  return (query as Record<string, unknown>)['inline-preview'] !== undefined
}

/** Normalizes a local route path and rejects URLs, queries, and fragments. */
export const normalizeContentRoutePath = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.includes('?') ||
    trimmed.includes('#') ||
    trimmed.includes('://')
  ) {
    return null
  }

  if (trimmed === '/') {
    return '/'
  }

  return trimmed.replace(/\/+$/, '')
}

/** Parses and validates route-access metadata without mutating the document. */
export const parseContentRouteAccessPolicy = (
  meta: unknown,
  targetPath: string,
): ParsedContentRouteAccessPolicy => {
  const record = meta && typeof meta === 'object' && !Array.isArray(meta)
    ? meta as Record<string, unknown>
    : {}
  const raw = record.routeAccess

  if (raw === undefined || raw === null) {
    return { status: 'public' }
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { status: 'invalid', reason: 'routeAccess must be an object' }
  }

  const rawPolicy = raw as Record<string, unknown>
  if (rawPolicy.mode === 'public') {
    return { status: 'public' }
  }
  if (rawPolicy.mode !== 'entry-session') {
    return { status: 'invalid', reason: 'Unsupported route access mode' }
  }

  if (!Array.isArray(rawPolicy.allowedFrom) || rawPolicy.allowedFrom.length === 0) {
    return { status: 'invalid', reason: 'At least one allowed source route is required' }
  }

  const allowedFrom: string[] = []
  for (const candidate of rawPolicy.allowedFrom) {
    const normalized = normalizeContentRoutePath(candidate)
    if (!normalized) {
      return { status: 'invalid', reason: 'Allowed source routes must be internal paths' }
    }
    if (!allowedFrom.includes(normalized)) {
      allowedFrom.push(normalized)
    }
  }

  const redirectTo = normalizeContentRoutePath(rawPolicy.redirectTo)
  if (!redirectTo) {
    return { status: 'invalid', reason: 'Redirect route must be an internal path' }
  }
  if (!allowedFrom.includes(redirectTo)) {
    return { status: 'invalid', reason: 'Redirect route must be one of the allowed source routes' }
  }

  const normalizedTarget = normalizeContentRoutePath(targetPath)
  if (!normalizedTarget) {
    return { status: 'invalid', reason: 'Target route must be an internal path' }
  }
  if (allowedFrom.includes(normalizedTarget)) {
    return { status: 'invalid', reason: 'Target route cannot grant access to itself' }
  }

  return {
    status: 'valid',
    policy: {
      mode: 'entry-session',
      allowedFrom,
      redirectTo,
    },
  }
}

/** Resolves the navigation action for a valid entry-session policy. */
export const resolveContentRouteAccessAction = (input: {
  policy: ContentRouteAccessPolicy
  fromPath: string | null | undefined
  hasSession: boolean
}): ContentRouteAccessAction => {
  if (input.hasSession) {
    return { type: 'allow', grantSession: false }
  }

  const normalizedFrom = normalizeContentRoutePath(input.fromPath)
  if (normalizedFrom && input.policy.allowedFrom.includes(normalizedFrom)) {
    return { type: 'allow', grantSession: true }
  }

  return { type: 'redirect', to: input.policy.redirectTo }
}

/** Creates a short deterministic fingerprint suitable for a cookie suffix. */
const fingerprint = (value: string): string => {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

/** Builds a target- and policy-specific browser-session cookie name. */
export const buildContentRouteAccessCookieName = (
  targetPath: string,
  policy: ContentRouteAccessPolicy,
): string => {
  const normalizedTarget = normalizeContentRoutePath(targetPath) ?? targetPath
  const policyValue = [
    normalizedTarget,
    ...policy.allowedFrom,
    policy.redirectTo,
  ].join('|')

  return `cf_content_entry_${fingerprint(policyValue)}`
}
