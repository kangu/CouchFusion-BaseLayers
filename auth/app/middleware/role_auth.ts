import { createError } from '#app'
import { useAuthStore } from '#imports'

export default defineNuxtRouteMiddleware(async (to) => {
  const authStore = useAuthStore()

  if (!authStore.user) {
    const { data } = await useFetch('/api/login', {
      query: { cache: Date.now() }
    })

    if (data.value) {
      authStore.setLoggedUser(data.value)
    }
  }

  const allowedRoles = Array.isArray(to.meta.authAllowedRoles) && to.meta.authAllowedRoles.length
    ? to.meta.authAllowedRoles
    : ['admin']
  const roles = Array.isArray(authStore.user?.roles) ? authStore.user?.roles : []

  const hasRole = authStore.user && allowedRoles.some((role) => roles.includes(role))

  if (!hasRole) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
  }
})
