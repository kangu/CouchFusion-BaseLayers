import { defineNitroPlugin } from 'nitropack/runtime'
import { getCouchDBSettings } from './settings'
export default defineNitroPlugin(async () => {
  await getCouchDBSettings()
})
