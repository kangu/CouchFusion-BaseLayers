import { useAuthStore } from '../app/stores/auth'

export default defineNuxtRouteMiddleware(async (to) => {
    // only run this on server
    // for client implementations use a different method
    if (process.server) {
        const authStore = useAuthStore()

        const data = await authStore.fetchUser()
        // const {data} = await useFetch('/api/login')
        if (data) {
            // console.log('Setting logged user', JSON.parse(JSON.stringify(data)))
            // authStore.setLoggedUser(data.value)
        }
    }
})
