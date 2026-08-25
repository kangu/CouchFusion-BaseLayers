import { defineEventHandler } from 'h3'
import { assertImageKitConfig } from '../../utils/imagekit-config'

/** Exposes the non-secret ImageKit settings loaded during server startup. */
export default defineEventHandler(() => {
  const config = assertImageKitConfig()

  return {
    publicKey: config.publicKey,
    urlEndpoint: config.urlEndpoint,
    folder: config.folder,
  }
})
