import { initializeDatabase, validateCouchDBEnvironment } from '#database/utils/couchdb'
import { contentDesignDocument } from '../../utils/design-documents'

async function initializeContentLayer(): Promise<void> {
    console.log('🧩 Initializing CouchDB for content layer...')

    try {
        validateCouchDBEnvironment()

        const runtimeConfig = useRuntimeConfig()
        const dbContentPrefix = runtimeConfig.dbContentPrefix

        if (!dbContentPrefix) {
            throw new Error('Missing dbContentPrefix runtime configuration for content layer')
        }

        const contentDatabaseName = `${dbContentPrefix}-content`

        await initializeDatabase(contentDatabaseName, [contentDesignDocument])

        console.log(`📄 Content database ready: ${contentDatabaseName}`)
    } catch (error) {
        console.error('💥 Content layer initialization failed:', error)
    }
}

export default async () => {
    await initializeContentLayer()
}
