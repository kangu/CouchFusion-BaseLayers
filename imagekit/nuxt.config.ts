import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  alias: {
    '#imagekit': fileURLToPath(new URL('.', import.meta.url)),
  },

  imports: {
    dirs: ['composables', 'utils'],
  },

  plugins: [{ src: fileURLToPath(new URL('./plugins/imagekit-directive', import.meta.url)) }],

  runtimeConfig: {
    imagekit: {
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
    },
    public: {
      imagekit: {
        publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
        urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
      },
    },
  },

  typescript: {
    strict: true,
  },

  devtools: {
    enabled: true,
  },
})
