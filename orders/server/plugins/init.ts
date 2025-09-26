import { initializeDatabase, validateCouchDBEnvironment } from '#database/utils/couchdb'
import { ordersDesignDocument } from '../../utils/design-documents'

async function initializeOrdersLayer(): Promise<void> {
  console.log('🔧 Initializing CouchDB for orders layer...')

  try {
    const runtimeConfig = useRuntimeConfig()
    const dbLoginPrefix = runtimeConfig.dbLoginPrefix

    validateCouchDBEnvironment()

    const ordersDatabaseName = `${dbLoginPrefix}-orders`
    await initializeDatabase(ordersDatabaseName, [ordersDesignDocument])

    console.log('🎉 CouchDB orders layer initialization completed successfully')
  } catch (error) {
    console.error('💥 CouchDB orders layer initialization failed:', error)
  }
}

export default async () => {
  await initializeOrdersLayer()
}
