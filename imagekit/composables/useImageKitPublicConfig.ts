import type { Ref } from 'vue'

export interface ImageKitPublicConfig {
  publicKey: string
  urlEndpoint: string
  folder?: string
}

let loadPromise: Promise<ImageKitPublicConfig> | null = null

/** Provides the public ImageKit settings that are initialized from CouchDB on the server. */
export const useImageKitPublicConfig = (): {
  config: Ref<ImageKitPublicConfig | null>
  load: () => Promise<ImageKitPublicConfig>
} => {
  const config = useState<ImageKitPublicConfig | null>('imagekit-public-config', () => null)

  const load = async (): Promise<ImageKitPublicConfig> => {
    if (config.value) {
      return config.value
    }

    loadPromise ??= $fetch<ImageKitPublicConfig>('/api/imagekit/runtime-config')

    try {
      config.value = await loadPromise
      return config.value
    } finally {
      loadPromise = null
    }
  }

  return { config, load }
}
