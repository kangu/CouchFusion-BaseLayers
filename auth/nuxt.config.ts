import {fileURLToPath} from 'node:url'

export default defineNuxtConfig({
    alias: {
        '#auth': fileURLToPath(new URL('.', import.meta.url))
    },
    modules: ['@pinia/nuxt'],
    extends: ['../database'],

    imports: {
        dirs: [
            // 'app/composables',
            fileURLToPath(new URL('./app/composables', import.meta.url)),
            fileURLToPath(new URL('./app/middleware', import.meta.url)),
            // 'middleware',
            // 'app/stores',
            fileURLToPath(new URL('./app/stores', import.meta.url))
        ]
    },

    nitro: {
        experimental: {
            websocket: true
        },
        routeRules: {
            '/api/**': {cors: true}
            // '/**': {headers: {'x-powered-by': 'my-org'}}
        }
    },


    runtimeConfig: {
        couchUrl: process.env.COUCHDB_URL || 'http://localhost:5984',
        couchAdminAuth: process.env.COUCHDB_ADMIN_AUTH,
        couchdbCookieSecret: process.env.NUXT_COUCHDB_COOKIE_SECRET || process.env.COUCHDB_COOKIE_SECRET,
        public: {
            authLoginPath: '/login'
        }
    },

    typescript: {
        strict: true
    },

    hooks: {
        'ready': async (nuxt) => {
            // Validate that the consuming application provides required runtime config
            const runtimeConfig = nuxt.options.runtimeConfig

            if (!runtimeConfig.dbLoginPrefix) {
                throw new Error(`
🚨 Auth Layer Configuration Error:
The auth layer requires 'dbLoginPrefix' to be configured in your app's runtimeConfig.

Add this to your nuxt.config.ts:
runtimeConfig: {
  dbLoginPrefix: 'your-prefix-',
  // ... other config
}
                `.trim())
            }

            // Validate required environment variables
            if (!process.env.COUCHDB_ADMIN_AUTH) {
                throw new Error(`
🚨 Auth Layer Environment Error:
The auth layer requires 'COUCHDB_ADMIN_AUTH' environment variable to be set.

Set this environment variable with a base64-encoded admin credentials:
COUCHDB_ADMIN_AUTH=base64(username:password)

Example:
COUCHDB_ADMIN_AUTH=YWRtaW46cGFzc3dvcmQ=
                `.trim())
            }

            if (!process.env.NUXT_COUCHDB_COOKIE_SECRET && !process.env.COUCHDB_COOKIE_SECRET) {
                throw new Error(`
🚨 Auth Layer Environment Error:
The auth layer requires 'COUCHDB_COOKIE_SECRET' environment variable to be set.

For development: COUCHDB_COOKIE_SECRET=your-secret
For production deployment: NUXT_COUCHDB_COOKIE_SECRET=your-secret

Production Note: When using 'nuxt build' and deploying with runtime environment override,
use the NUXT_ prefixed version. The NUXT_ prefix allows runtime override of build-time values.

Example:
# Development
COUCHDB_COOKIE_SECRET=45213e7a8ec395d1ddec4f78cc011672

# Production deployment
NUXT_COUCHDB_COOKIE_SECRET=production-secret-override
                `.trim())
            }

            // Validate base64 format
            try {
                const decoded = Buffer.from(process.env.COUCHDB_ADMIN_AUTH, 'base64').toString('utf-8')
                if (!decoded.includes(':')) {
                    throw new Error('Invalid format')
                }
            } catch (error) {
                throw new Error(`
🚨 Auth Layer Environment Error:
'COUCHDB_ADMIN_AUTH' must be a valid base64-encoded string in format 'username:password'.

Current value appears to be invalid.
Expected format: base64(username:password)
                `.trim())
            }
        }
    }
})
