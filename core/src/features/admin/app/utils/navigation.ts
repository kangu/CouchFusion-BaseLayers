import type { AdminSection } from '../../../auth-client/app/utils/types'
import { safeRedirect } from '../../../auth-client/app/utils/redirect'
export { safeRedirect } from '../../../auth-client/app/utils/redirect'
export function buildAdminNavigation(
  sections: AdminSection[],
  hasRole: (role: string) => boolean,
): AdminSection[] {
  const allowed = (roles?: string[]) => !roles?.length || roles.some(hasRole)
  const result = new Map<string, AdminSection>()
  for (const section of sections) {
    if (!allowed(section.requiresRoles)) continue
    const key = section.id || section.title
    const current = result.get(key) ?? { ...section, items: [] }
    const routes = new Set(current.items.map((item) => item.route))
    for (const item of section.items) {
      if (
        !allowed(item.requiresRoles) ||
        safeRedirect(item.route, '') !== item.route ||
        routes.has(item.route)
      )
        continue
      current.items.push({ ...item })
      routes.add(item.route)
    }
    if (current.items.length) result.set(key, current)
  }
  return [...result.values()]
}
export function isNavigationActive(route: string, path: string): boolean {
  return route === path || (route !== '/admin' && path.startsWith(`${route}/`))
}
