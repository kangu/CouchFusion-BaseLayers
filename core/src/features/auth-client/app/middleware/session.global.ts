import {
  createError,
  defineNuxtRouteMiddleware,
  navigateTo,
  useNuxtApp,
} from '#imports'
import { useCouchDBAuth } from '../composables/useCouchDBAuth'
import { safeRedirect } from '../utils/redirect'
export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useCouchDBAuth()
  const app = useNuxtApp()
  const adminRoute = to.path === '/admin' || to.path.startsWith('/admin/')
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
    if (settings.admin.roles.length && !settings.admin.roles.some(auth.hasRole))
      throw createError({ statusCode: 403, statusMessage: 'Access denied' })
  }
  if (to.path === settings.auth.loginPath && auth.user.value) {
    const target = safeRedirect(
      to.query.redirect,
      safeRedirect(settings.auth.redirectPath, '/admin'),
    )
    return navigateTo(target === settings.auth.loginPath ? '/admin' : target)
  }
})
