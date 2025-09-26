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
                    apiKey: process.env.STRIKE_API_KEY,
                    webhookSecret: process.env.STRIKE_WEBHOOK_SECRET
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
    defaultProvider: 'strike', // or 'boltz'
    providers: {
      strike: {
        apiKey: process.env.STRIKE_API_KEY,
        webhookSecret: process.env.STRIKE_WEBHOOK_SECRET
      },
      // or
      boltz: {
        apiUrl: 'https://api.boltz.exchange/',
        network: 'mainnet',
        liquidAddress: 'your-liquid-address'
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

Valid options: 'strike' or 'boltz'
                `.trim())
            }

            if (!['strike', 'boltz'].includes(lightningConfig.defaultProvider)) {
                throw new Error(`
🚨 Lightning Layer Configuration Error:
'defaultProvider' must be either 'strike' or 'boltz'.

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
    apiKey: process.env.STRIKE_API_KEY,
    webhookSecret: process.env.STRIKE_WEBHOOK_SECRET
  }
}
                `.trim())
            }

            // Validate Strike provider configuration
            if (lightningConfig.providers.strike) {
                const strikeConfig = lightningConfig.providers.strike
                if (!strikeConfig.apiKey) {
                    throw new Error(`
🚨 Lightning Layer Configuration Error:
Strike provider requires 'apiKey' to be configured.

Set STRIKE_API_KEY environment variable or configure directly:
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

            // Validate Boltz provider configuration
            if (lightningConfig.providers.boltz) {
                const boltzConfig = lightningConfig.providers.boltz
                if (!boltzConfig.liquidAddress) {
                    throw new Error(`
🚨 Lightning Layer Configuration Error:
Boltz provider requires 'liquidAddress' for receiving Liquid Bitcoin.

Configure your Liquid address:
providers: {
  boltz: {
    liquidAddress: 'your-liquid-address',
    network: 'mainnet'
  }
}
                    `.trim())
                }
                if (!boltzConfig.network || !['mainnet', 'testnet'].includes(boltzConfig.network)) {
                    throw new Error(`
🚨 Lightning Layer Configuration Error:
Boltz provider requires 'network' to be either 'mainnet' or 'testnet'.

Current value: ${boltzConfig.network}
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
