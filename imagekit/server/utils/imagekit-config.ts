import { createError } from 'h3'
import {
  buildCouchEnvSection,
  readCouchConfigValues,
  resolveRuntimeAppSlug,
} from '#database/utils/couch-config'

const IMAGEKIT_CONFIG_KEYS = [
  'imagekit_public_key',
  'imagekit_private_key',
  'imagekit_url_endpoint',
  'imagekit_folder',
] as const

type ImageKitConfigKey = (typeof IMAGEKIT_CONFIG_KEYS)[number]

export interface ImageKitRuntimeConfig {
  publicKey: string
  privateKey: string
  urlEndpoint: string
  folder?: string
  section: string
}

let cachedConfig: ImageKitRuntimeConfig | null = null
let initializationPromise: Promise<ImageKitRuntimeConfig> | null = null

/** Normalizes a CouchDB configuration value while preserving empty optional values. */
const normalizeValue = (value: string | null | undefined): string | undefined => {
  const normalized = value?.trim()
  return normalized || undefined
}

/** Reads the ImageKit credentials once from the current application's CouchDB environment section. */
const loadImageKitConfig = async (): Promise<ImageKitRuntimeConfig> => {
  const runtimeConfig = useRuntimeConfig()
  const appSlug = resolveRuntimeAppSlug(runtimeConfig)
  const section = buildCouchEnvSection(appSlug)
  const values = await readCouchConfigValues(section, [...IMAGEKIT_CONFIG_KEYS])

  const config = {
    publicKey: normalizeValue(values.imagekit_public_key),
    privateKey: normalizeValue(values.imagekit_private_key),
    urlEndpoint: normalizeValue(values.imagekit_url_endpoint)?.replace(/\/$/, ''),
    folder: normalizeValue(values.imagekit_folder)?.replace(/^\/+|\/+$/g, ''),
  }
  const missing = (Object.entries(config) as [ImageKitConfigKey | 'folder', string | undefined][])
    .filter(([key, value]) => key !== 'folder' && !value)
    .map(([key]) => key)

  if (missing.length > 0) {
    throw createError({
      statusCode: 500,
      statusMessage: `ImageKit configuration is incomplete in CouchDB section "${section}". Missing: ${missing.join(', ')}.`,
    })
  }

  return {
    publicKey: config.publicKey!,
    privateKey: config.privateKey!,
    urlEndpoint: config.urlEndpoint!,
    folder: config.folder,
    section,
  }
}

/** Initializes and memoizes ImageKit configuration for the Nitro process lifetime. */
export const initializeImageKitConfig = async (): Promise<ImageKitRuntimeConfig> => {
  if (cachedConfig) {
    return cachedConfig
  }

  initializationPromise ??= loadImageKitConfig()

  try {
    cachedConfig = await initializationPromise
    return cachedConfig
  } finally {
    initializationPromise = null
  }
}

/** Returns the startup-cached ImageKit configuration without issuing a database request. */
export const getImageKitConfig = (): ImageKitRuntimeConfig | null => cachedConfig

/** Returns the initialized ImageKit configuration or a clear server error. */
export const assertImageKitConfig = (): ImageKitRuntimeConfig => {
  if (!cachedConfig) {
    throw createError({
      statusCode: 503,
      statusMessage: 'ImageKit configuration is not initialized.',
    })
  }

  return cachedConfig
}
