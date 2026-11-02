import { useAuthStore } from '../stores/auth'
import { DEFAULT_AUTH_HIDDEN_PATHS, isAuthHiddenPath, parseAuthHiddenPaths } from '../utils/hidden-paths'

export default defineNuxtRouteMiddleware(async (to, from) => {
    const config = useRuntimeConfig()
    const authStore = useAuthStore()

    const data = await authStore.fetchUser()

    if (!(data) && to.path !== config.public.authLoginPath) {
        // Admin areas (/admin, /builder, /k by default) don't reveal themselves: a signed-out
        // visitor gets the site's 404, no redirect and no redirectTo cookie. Editors open the
        // login page directly.
        const hidden = parseAuthHiddenPaths(config.public.authHiddenPaths ?? DEFAULT_AUTH_HIDDEN_PATHS)
        if (isAuthHiddenPath(to.path, hidden)) {
            throw createError({ statusCode: 404, statusMessage: 'Page not found' })
        }

        // Store the target path to redirect after successful login
        const redirectTo = useCookie('redirectTo')
        redirectTo.value = to.fullPath
        return navigateTo(config.public.authLoginPath);
    }
})
