import { defineNuxtRouteMiddleware } from '#imports'
import { useContentPagesStore } from '#content/app/stores/pages'

export default defineNuxtRouteMiddleware(async (to) => {
    const store = useContentPagesStore()

    try {
        console.log('Fetching page', to.path)
        await store.fetchPage(to.path)
    } catch (error: any) {
        if (error?.statusCode !== 404) {
            console.error('Content middleware fetch error:', error)
        }
    }
})
