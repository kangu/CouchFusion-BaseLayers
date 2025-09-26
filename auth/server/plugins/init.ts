/**
 * Nitro server plugin for CouchDB initialization
 * Runs on server startup to ensure required design documents exist
 */

import {initializeDatabase, validateCouchDBEnvironment} from '#database/utils/couchdb';
import {authDesignDocument} from '../../utils/design-documents';

/**
 * Initialize CouchDB for auth layer
 */
async function initializeAuthLayer(): Promise<void> {
    console.log('🔧 Initializing CouchDB for auth layer...');

    try {
        // Get runtime config for database naming
        const runtimeConfig = useRuntimeConfig();
        const dbLoginPrefix = runtimeConfig.dbLoginPrefix;
        // Validate environment variables
        validateCouchDBEnvironment();

        // Initialize _users database with auth design documents
        await initializeDatabase('_users', [authDesignDocument]);

        const loginDatabaseName = `${dbLoginPrefix}-logins`;
        await initializeDatabase(loginDatabaseName, []);

        console.log('🎉 CouchDB auth layer initialization completed successfully');

    } catch (error) {
        console.error('💥 CouchDB auth layer initialization failed:', error);
        // Don't throw here to prevent server startup failure
        // The validation will catch missing config at runtime
    }
}

// Nitro plugin - runs on server startup
export default async () => {
    await initializeAuthLayer();
};
