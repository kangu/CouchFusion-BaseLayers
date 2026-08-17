import { normalizeContentRoutePath } from '#content/utils/route-access'

export type ParsedContentPageRedirect =
  | { status: 'none' }
  | { status: 'valid'; targetPath: string }
  | { status: 'invalid'; reason: string }

export const parseContentPageRedirect = (
  meta: unknown,
  sourcePath: string,
): ParsedContentPageRedirect => {
  const record = meta && typeof meta === 'object' && !Array.isArray(meta)
    ? meta as Record<string, unknown>
    : {}

  if (record.redirectTo === undefined || record.redirectTo === null) {
    return { status: 'none' }
  }

  const targetPath = normalizeContentRoutePath(record.redirectTo)
  const normalizedSourcePath = normalizeContentRoutePath(sourcePath)
  if (!targetPath || !normalizedSourcePath || targetPath === normalizedSourcePath) {
    return {
      status: 'invalid',
      reason: 'Redirect target must be a different internal path',
    }
  }

  return { status: 'valid', targetPath }
}

export const createContentPageRedirectMeta = (targetPath: string) => ({
  redirectTo: targetPath,
})
