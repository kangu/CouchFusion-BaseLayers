import { initializeDatabase, validateCouchDBEnvironment } from '#database/utils/couchdb'
import { contentDesignDocument } from '../../utils/design-documents'

async function initializeContentLayer(): Promise<void> {
    console.log('🧩 Initializing CouchDB for content layer...')

    try {
        validateCouchDBEnvironment()

        const runtimeConfig = useRuntimeConfig()
        const dbLoginPrefix = runtimeConfig.dbLoginPrefix

        if (!dbLoginPrefix) {
            throw new Error('Missing dbLoginPrefix runtime configuration for content layer')
        }

        const contentDatabaseName = `${dbLoginPrefix}-content`

        await initializeDatabase(contentDatabaseName, [contentDesignDocument])

        console.log(`📄 Content database ready: ${contentDatabaseName}`)
    } catch (error) {
        console.error('💥 Content layer initialization failed:', error)
    }
}

export default async () => {
    await initializeContentLayer()
}
