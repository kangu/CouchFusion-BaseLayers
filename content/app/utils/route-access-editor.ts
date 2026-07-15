import type { ContentRouteAccessPolicy } from '#content/types/content-page'
import {
  normalizeContentRoutePath,
  parseContentRouteAccessPolicy,
} from '#content/utils/route-access'

export interface RouteAccessDraft {
  mode: 'public' | 'entry-session'
  allowedFromText: string
  redirectTo: string
}

export type RouteAccessDraftValidation =
  | { valid: true; errors: []; policy: ContentRouteAccessPolicy | null }
  | { valid: false; errors: string[]; policy: null }

/** Creates editor-safe fields while retaining malformed persisted values for correction. */
export const createRouteAccessDraft = (
  meta: Record<string, any> | null | undefined,
  targetPath: string,
): RouteAccessDraft => {
  const parsed = parseContentRouteAccessPolicy(meta, targetPath)
  if (parsed.status === 'valid') {
    return {
      mode: 'entry-session',
      allowedFromText: parsed.policy.allowedFrom.join('\n'),
      redirectTo: parsed.policy.redirectTo,
    }
  }

  const raw = meta?.routeAccess
  if (raw?.mode === 'entry-session') {
    return {
      mode: 'entry-session',
      allowedFromText: Array.isArray(raw.allowedFrom)
        ? raw.allowedFrom.map((entry: unknown) => String(entry ?? '')).join('\n')
        : '',
      redirectTo: typeof raw.redirectTo === 'string' ? raw.redirectTo : '',
    }
  }

  return {
    mode: 'public',
    allowedFromText: '',
    redirectTo: '',
  }
}

/** Validates the editable route list and returns a normalized persistence policy. */
export const validateRouteAccessDraft = (
  draft: RouteAccessDraft,
  targetPath: string,
): RouteAccessDraftValidation => {
  if (draft.mode === 'public') {
    return { valid: true, errors: [], policy: null }
  }

  const errors: string[] = []
  const rawSources = draft.allowedFromText
    .split(/\r?\n/)
    .map(entry => entry.trim())
    .filter(Boolean)
  const allowedFrom: string[] = []

  if (rawSources.length === 0) {
    errors.push('Add at least one allowed source route.')
  }

  for (const source of rawSources) {
    const normalized = normalizeContentRoutePath(source)
    if (!normalized) {
      if (!errors.some(error => error.includes('internal paths'))) {
        errors.push('Allowed source routes must be internal paths without queries or fragments.')
      }
      continue
    }
    if (!allowedFrom.includes(normalized)) {
      allowedFrom.push(normalized)
    }
  }

  const normalizedTarget = normalizeContentRoutePath(targetPath)
  if (normalizedTarget && allowedFrom.includes(normalizedTarget)) {
    errors.push('Allowed source routes cannot include the target page.')
  }

  const redirectTo = normalizeContentRoutePath(draft.redirectTo)
  if (!redirectTo) {
    errors.push('Redirect route must be an internal path without a query or fragment.')
  } else if (!allowedFrom.includes(redirectTo)) {
    errors.push('Redirect route must match an allowed source route.')
  }

  if (errors.length > 0 || !redirectTo) {
    return { valid: false, errors, policy: null }
  }

  return {
    valid: true,
    errors: [],
    policy: {
      mode: 'entry-session',
      allowedFrom,
      redirectTo,
    },
  }
}

/** Applies a valid draft without disturbing other page metadata. */
export const applyRouteAccessDraft = (
  meta: Record<string, any> | null | undefined,
  targetPath: string,
  draft: RouteAccessDraft,
): ({ valid: true; errors: []; meta: Record<string, any> } | {
  valid: false
  errors: string[]
  meta: Record<string, any>
}) => {
  const validation = validateRouteAccessDraft(draft, targetPath)
  const nextMeta = { ...(meta ?? {}) }

  if (!validation.valid) {
    return { valid: false, errors: validation.errors, meta: nextMeta }
  }

  if (validation.policy) {
    nextMeta.routeAccess = validation.policy
  } else {
    delete nextMeta.routeAccess
  }

  return { valid: true, errors: [], meta: nextMeta }
}

/** Route access is a master-page setting and is read-only for translations. */
export const isRouteAccessEditorReadOnly = (
  locale: string,
  defaultLocale: string,
): boolean => locale !== defaultLocale
