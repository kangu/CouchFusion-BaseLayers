import { useAuthStore } from '../stores/auth'

export default defineNuxtRouteMiddleware(async (to, from) => {
    const config = useRuntimeConfig()
    const authStore = useAuthStore()

    const data = await authStore.fetchUser()

    if (!(data) && to.path !== config.public.authLoginPath) {
        // Store the target path to redirect after successful login
        const redirectTo = useCookie('redirectTo')
        redirectTo.value = to.fullPath
        return navigateTo(config.public.authLoginPath);
    }
})
