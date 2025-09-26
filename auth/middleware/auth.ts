import { useAuthStore } from '../app/stores/auth'

export default defineNuxtRouteMiddleware(async (to, from) => {
    const config = useRuntimeConfig()
    const authStore = useAuthStore()

    // cannot properly use authStore here because the login call is incorrectly cached
    const bustCache = Date.now()
    const { data } = await useFetch('/api/login?cache=' + bustCache)
    if (data.value) {
        // make sure to set it if it's the first time coming in from a redirect
        authStore.setLoggedUser(data.value)
    }
    // const data = await authStore.fetchUser()

    if (!(data.value) && to.path !== config.public.authLoginPath) {
        // Store the target path to redirect after successful login
        const redirectTo = useCookie('redirectTo')
        redirectTo.value = to.fullPath
        return navigateTo(config.public.authLoginPath);
    }
})
