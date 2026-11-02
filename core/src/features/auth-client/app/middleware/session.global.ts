import {
  createError,
  defineNuxtRouteMiddleware,
  navigateTo,
  useNuxtApp,
} from '#imports'
import { useCouchDBAuth } from '../composables/useCouchDBAuth'
import { safeRedirect } from '../utils/redirect'
import {
  canOpen,
  hasAdminAccess,
  isAdminPath,
  loginDestination,
} from '../utils/access'
export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useCouchDBAuth()
  const app = useNuxtApp()
  const adminRoute = isAdminPath(to.path)
  const hydratingSession =
    app.isHydrating && app.payload.serverRendered && auth.initialized.value
  if (
    !auth.initialized.value ||
    (!hydratingSession &&
      (import.meta.server ||
        adminRoute ||
        to.path === auth.settings.value?.auth.loginPath))
  )
    await auth.refresh()
  const settings = auth.settings.value!
  if (adminRoute) {
    if (!settings.features.admin)
      throw createError({ statusCode: 404, statusMessage: 'Page not found' })
    if (!auth.user.value) {
      if (!settings.features.ui)
        throw createError({
          statusCode: 401,
          statusMessage: 'Authentication required',
        })
      return navigateTo({
        path: safeRedirect(settings.auth.loginPath, '/login'),
        query: { redirect: to.fullPath },
      })
    }
    if (!hasAdminAccess(settings, auth.user.value))
      throw createError({ statusCode: 403, statusMessage: 'Access denied' })
  }
  if (to.path === settings.auth.loginPath && auth.user.value) {
    const target = loginDestination(to.query.redirect, settings)
    // A user who cannot open the target stays here; the login page offers a sign-out.
    if (canOpen(target, settings, auth.user.value)) return navigateTo(target)
  }
})
