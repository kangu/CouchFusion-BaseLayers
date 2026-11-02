import { defineNitroPlugin } from 'nitropack/runtime'
import { createServiceClient, getBootstrapConfig } from '#core/server/client'
import { getCouchDBSettings } from '#core/server/settings'
import { liveUsersHub } from './hub'
export default defineNitroPlugin(async (nitro) => {
  const settings = await getCouchDBSettings()
  if (!settings.features.liveUsers) return
  const bootstrap = getBootstrapConfig()
  liveUsersHub.start(createServiceClient(bootstrap))
  nitro.hooks.hook('close', () => liveUsersHub.stop())
})
