import { initializeImageKitConfig } from '../utils/imagekit-config'

async function initializeImageKitLayer(): Promise<void> {
  console.log('🖼️ Initializing ImageKit layer...')

  try {
    const config = await initializeImageKitConfig()
    console.log(`✅ ImageKit configuration loaded from CouchDB section "${config.section}"`)
  } catch (error) {
    console.error('💥 ImageKit layer initialization failed:', error)
  }
}

export default async () => {
  await initializeImageKitLayer()
}
