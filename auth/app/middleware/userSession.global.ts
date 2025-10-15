import { useAuthStore } from '../stores/auth'

export default defineNuxtRouteMiddleware(async (to) => {
    const config = useRuntimeConfig()
    // only run this on server for first req
    if (process.server) {
        const authStore = useAuthStore()
        // user is set to store directly after a valid response
        await authStore.fetchUser()

        // for debuggingxx
        console.log('Cookie sected', config.couchdbCookieSecret)
    }
})
