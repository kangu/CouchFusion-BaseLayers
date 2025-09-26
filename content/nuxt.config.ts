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

    components: {},

    runtimeConfig: {
        dbContentPrefix: null,
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

            if (!runtimeConfig.dbContentPrefix) {
                throw new Error(`
🚨 Content Layer Configuration Error:
The content layer requires 'dbContentPrefix' to be configured in your app's runtimeConfig.

Add this to your nuxt.config.ts:
runtimeConfig: {
  dbContentPrefix: 'your-prefix',
  // ... other config
}
                `.trim())
            }
        }
    },

    devtools: { enabled: true }
})
