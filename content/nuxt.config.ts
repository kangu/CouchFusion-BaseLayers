import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
    alias: {
        '#content': fileURLToPath(new URL('.', import.meta.url))
    },

    extends: ['../database'],

    modules: [],

    imports: {
        dirs: ['app/composables', 'app/stores']
    },

    components: {
        dirs: [
            /* global component import comes from the implementing app */
            {
                path: './app/components/builder',
                global: true,
                pathPrefix: false
            },
            {
                path: './app/components/runtime',
                global: true,
                pathPrefix: false
            }
        ]
    },

    runtimeConfig: {
        public: {
            content: {}
        }
    },

    typescript: {
        strict: true
    },

    hooks: {
        ready: async (nuxt) => {
            const runtimeConfig = nuxt.options.runtimeConfig

            if (!runtimeConfig.dbLoginPrefix) {
                throw new Error(`
🚨 Content Layer Configuration Error:
The content layer requires 'dbLoginPrefix' to be configured in your app's runtimeConfig.

Add this to your nuxt.config.ts:
runtimeConfig: {
  dbLoginPrefix: 'your-prefix',
  // ... other config
}
                `.trim())
            }
        }
    },

    devtools: { enabled: true }
})
