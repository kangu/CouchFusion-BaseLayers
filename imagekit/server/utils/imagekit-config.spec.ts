import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readCouchConfigValues: vi.fn(),
}))

vi.mock('#database/utils/couch-config', () => ({
  buildCouchEnvSection: (slug: string) => `cf_env_${slug}`,
  readCouchConfigValues: mocks.readCouchConfigValues,
  resolveRuntimeAppSlug: (runtimeConfig: { public?: { appSlug?: string } }) => runtimeConfig.public?.appSlug || '',
}))

describe('ImageKit CouchDB runtime configuration', () => {
  beforeEach(() => {
    mocks.readCouchConfigValues.mockReset()
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { appSlug: 'bitvocation' } }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('loads and caches app-scoped CouchDB values once', async () => {
    mocks.readCouchConfigValues.mockResolvedValue({
      imagekit_public_key: ' public-key ',
      imagekit_private_key: ' private-key ',
      imagekit_url_endpoint: 'https://ik.imagekit.io/bitvocation/',
      imagekit_folder: ' content-editor ',
    })

    const config = await import('./imagekit-config')

    await expect(config.initializeImageKitConfig()).resolves.toMatchObject({
      publicKey: 'public-key',
      privateKey: 'private-key',
      urlEndpoint: 'https://ik.imagekit.io/bitvocation',
      folder: 'content-editor',
      section: 'cf_env_bitvocation',
    })
    await expect(config.initializeImageKitConfig()).resolves.toMatchObject({
      publicKey: 'public-key',
    })

    expect(mocks.readCouchConfigValues).toHaveBeenCalledTimes(1)
    expect(mocks.readCouchConfigValues).toHaveBeenCalledWith('cf_env_bitvocation', [
      'imagekit_public_key',
      'imagekit_private_key',
      'imagekit_url_endpoint',
      'imagekit_folder',
    ])
    expect(config.getImageKitConfig()).toMatchObject({ publicKey: 'public-key' })
  })
})
