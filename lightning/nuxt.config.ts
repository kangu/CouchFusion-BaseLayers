import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
    alias: {
        '#lightning': fileURLToPath(new URL('.', import.meta.url))
    },
// Expose this layer's resources
    extends: ['../database'],


    modules: [
// shared modules for all apps
    ],


// Auto-import from layer
    imports: {
        dirs: ['app/composables', 'app/middleware', 'app/stores']
    },


    components: {
        // dirs: [{path: 'components', pathPrefix: false}]
    },


    nitro: {
        routeRules: {
            '/api/**': {cors: true},
            '/**': {headers: {'x-powered-by': 'btc'}}
        }
    },


    typescript: {
        strict: true
    },

    devtools: {enabled: true}
})
