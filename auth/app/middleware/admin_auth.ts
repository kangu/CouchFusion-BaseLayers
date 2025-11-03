import { useAuthStore } from '#imports'
import { createError } from '#app'

export default defineNuxtRouteMiddleware(async () => {
  const authStore = useAuthStore()

  if (!authStore.user) {
    const { data } = await useFetch('/api/login', {
      query: { cache: Date.now() }
    })

    if (data.value) {
      authStore.setLoggedUser(data.value)
    }
  }

  const roles = Array.isArray(authStore.user?.roles) ? authStore.user?.roles : []

  if (!authStore.user || !roles.includes('admin')) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
  }
})
