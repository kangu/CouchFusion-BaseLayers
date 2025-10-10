import { useRuntimeConfig } from '#imports'

interface ImageKitRuntimeConfig {
  imagekit?: {
    publicKey?: string
    privateKey?: string
    urlEndpoint?: string
  }
}

interface RequiredVariable {
  key: keyof NodeJS.ProcessEnv
  description: string
}

const REQUIRED_ENVIRONMENT_VARIABLES: RequiredVariable[] = [
  { key: 'IMAGEKIT_PUBLIC_KEY', description: 'Public key used by client-side uploads' },
  { key: 'IMAGEKIT_PRIVATE_KEY', description: 'Private key required for server-side operations' },
  { key: 'IMAGEKIT_URL_ENDPOINT', description: 'Base URL endpoint for transformed image delivery' },
]

function validateImageKitEnvironment(): void {
  const missing = REQUIRED_ENVIRONMENT_VARIABLES
    .filter(({ key }) => !process.env[key])
    .map(({ key, description }) => `- ${key}: ${description}`)

  if (missing.length > 0) {
    throw new Error(
      [
        '🚨 ImageKit Layer Configuration Error:',
        'The following environment variables must be set in your project root .env file:',
        '',
        ...missing,
        '',
        'Example configuration:',
        'IMAGEKIT_PUBLIC_KEY=your-public-key',
        'IMAGEKIT_PRIVATE_KEY=your-private-key',
        'IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your-id',
      ].join('\n'),
    )
  }
}

function validateImageKitRuntimeConfig(config: ImageKitRuntimeConfig): void {
  const runtime = config.imagekit || {}

  const missing: string[] = []

  if (!runtime.publicKey) {
    missing.push('- runtimeConfig.imagekit.publicKey')
  }

  if (!runtime.privateKey) {
    missing.push('- runtimeConfig.imagekit.privateKey')
  }

  if (!runtime.urlEndpoint) {
    missing.push('- runtimeConfig.imagekit.urlEndpoint')
  }

  if (missing.length > 0) {
    throw new Error(
      [
        '🚨 ImageKit Layer Runtime Config Error:',
        'Configure the following fields in your app\'s `nuxt.config.ts` runtimeConfig:',
        '',
        ...missing,
        '',
        'Example:',
        'runtimeConfig: {',
        "  imagekit: {",
        "    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,",
        "    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,",
        "    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,",
        '  }',
        '}',
      ].join('\n'),
    )
  }
}

async function initializeImageKitLayer(): Promise<void> {
  console.log('🖼️ Initializing ImageKit layer...')

  try {
    validateImageKitEnvironment()

    const runtimeConfig = useRuntimeConfig() as ImageKitRuntimeConfig
    validateImageKitRuntimeConfig(runtimeConfig)

    console.log('✅ ImageKit environment and runtime configuration verified')
  } catch (error) {
    console.error('💥 ImageKit layer initialization failed:', error)
  }
}

export default async () => {
  await initializeImageKitLayer()
}
