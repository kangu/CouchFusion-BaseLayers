import { safeRedirect } from './redirect'
import type { CouchDBUser, PublicSettings } from './types'

function pathOf(target: string) {
  return new URL(target, 'https://local.invalid').pathname
}

export function isAdminPath(target: string) {
  const path = pathOf(target)
  return path === '/admin' || path.startsWith('/admin/')
}

/** Mirrors the server role check: an empty role list admits any signed-in user. */
export function hasAdminAccess(
  settings: PublicSettings,
  user: CouchDBUser | null,
) {
  if (!user || !settings.features.admin) return false
  const roles = settings.admin.roles
  return !roles.length || roles.some((role) => user.roles.includes(role))
}

/** Route guards only cover the admin area; other local paths are left to the app. */
export function canOpen(
  target: string,
  settings: PublicSettings,
  user: CouchDBUser | null,
) {
  return !isAdminPath(target) || hasAdminAccess(settings, user)
}

/** Where a signed-in user goes from the login page; never the login page itself. */
export function loginDestination(redirect: unknown, settings: PublicSettings) {
  const target = safeRedirect(
    redirect,
    safeRedirect(settings.auth.redirectPath, '/admin'),
  )
  return pathOf(target) === pathOf(settings.auth.loginPath) ? '/admin' : target
}
