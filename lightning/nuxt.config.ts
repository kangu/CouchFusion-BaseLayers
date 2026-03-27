import { resolve } from 'path'

export default defineNuxtConfig({
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
            '/**': {headers: {'x-powered-by': 'my-org'}}
        }
    },


    runtimeConfig: {
        lightning: {
            defaultProvider: 'strike',
            providers: {
                strike: {
                    apiKey: process.env.NUXT_STRIKE_API_KEY,
                    webhookSecret: process.env.STRIKE_WEBHOOK_SECRET
                },
                blink: {
                    apiKey: process.env.NUXT_BLINK_API_KEY,
                    apiUrl: process.env.NUXT_BLINK_API_URL,
                    walletId: process.env.NUXT_BLINK_WALLET_ID,
                    webhookUrl: process.env.NUXT_BLINK_WEBHOOK_URL,
                    webhookEndpointId: process.env.NUXT_BLINK_WEBHOOK_ENDPOINT_ID
                }
            }
        },
        public: {
            /*authLoginPath: '/login'*/
        }
    },

    typescript: {
        strict: true
    },

    hooks: {
        'ready': async (nuxt) => {
            // Validate that the consuming application provides required Lightning config
            const runtimeConfig = nuxt.options.runtimeConfig

            if (!runtimeConfig.lightning) {
                throw new Error(`
🚨 Lightning Layer Configuration Error:
The Lightning layer requires 'lightning' configuration in your app's runtimeConfig.

Add this to your nuxt.config.ts:
runtimeConfig: {
  lightning: {
    defaultProvider: 'strike',
    providers: {
      strike: {
        apiKey: process.env.NUXT_STRIKE_API_KEY,
        webhookSecret: process.env.STRIKE_WEBHOOK_SECRET
      }
    }
  }
}
                `.trim())
            }

            const lightningConfig = runtimeConfig.lightning

            if (!lightningConfig.defaultProvider) {
                throw new Error(`
🚨 Lightning Layer Configuration Error:
'defaultProvider' must be specified in lightning configuration.

Valid options: 'strike', 'alby' or 'blink'
                `.trim())
            }

            if (!['strike', 'alby', 'blink'].includes(lightningConfig.defaultProvider)) {
                throw new Error(`
🚨 Lightning Layer Configuration Error:
'defaultProvider' must be either 'strike', 'alby' or 'blink'.

Current value: ${lightningConfig.defaultProvider}
                `.trim())
            }

            if (!lightningConfig.providers || Object.keys(lightningConfig.providers).length === 0) {
                throw new Error(`
🚨 Lightning Layer Configuration Error:
At least one provider must be configured in 'lightning.providers'.

Example configuration:
providers: {
  strike: {
    apiKey: process.env.NUXT_STRIKE_API_KEY,
    webhookSecret: process.env.STRIKE_WEBHOOK_SECRET
  }
}
                `.trim())
            }

            // Validate only the active default provider. Other provider entries may
            // exist as placeholders from layer defaults and should not block startup
            // until explicitly selected.
            if (lightningConfig.defaultProvider === 'strike') {
                const strikeConfig = lightningConfig.providers.strike
                if (!strikeConfig.apiKey) {
                    throw new Error(`
🚨 Lightning Layer Configuration Error:
Strike provider requires 'apiKey' to be configured.

Set NUXT_STRIKE_API_KEY environment variable or configure directly:
providers: {
  strike: {
    apiKey: 'your-strike-api-key',
    webhookSecret: 'your-webhook-secret'
  }
}
                    `.trim())
                }
                if (!strikeConfig.webhookSecret) {
                    throw new Error(`
🚨 Lightning Layer Configuration Error:
Strike provider requires 'webhookSecret' for webhook validation.

Set STRIKE_WEBHOOK_SECRET environment variable.
                    `.trim())
                }
            }

            if (lightningConfig.defaultProvider === 'blink') {
                const blinkConfig = lightningConfig.providers.blink
                if (!blinkConfig.apiKey) {
                    throw new Error(`
🚨 Lightning Layer Configuration Error:
Blink provider requires 'apiKey' to be configured.

Set NUXT_BLINK_API_KEY environment variable or configure directly:
providers: {
  blink: {
    apiKey: 'your-blink-api-key',
    walletId: 'your-btc-wallet-id'
  }
}
                    `.trim())
                }
            }

            // Validate that the default provider is actually configured
            if (!lightningConfig.providers[lightningConfig.defaultProvider]) {
                throw new Error(`
🚨 Lightning Layer Configuration Error:
Default provider '${lightningConfig.defaultProvider}' is not configured.

Make sure to configure the provider in lightning.providers.
                `.trim())
            }
        }
    },

    devtools: {enabled: true}
})
