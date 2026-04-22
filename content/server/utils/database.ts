import { createError } from 'h3'

/**
 * Resolve the content database name from runtime config, ensuring configuration is present.
 */
export function getContentDatabaseName(): string {
    const runtimeConfig = useRuntimeConfig()
    const dbLoginPrefix = runtimeConfig.dbLoginPrefix

    if (!dbLoginPrefix) {
        throw createError({
            statusCode: 500,
            statusMessage: 'Content database prefix (dbLoginPrefix) is not configured'
        })
    }

    return `${dbLoginPrefix}-content`
}

/**
 * Resolve the main application database name used for shared settings documents.
 * Allows an explicit content-layer override, otherwise falls back to the
 * established `${dbLoginPrefix}-orders` convention used by host apps.
 */
export function getMainDatabaseName(): string {
    const runtimeConfig = useRuntimeConfig()
    const explicitName = runtimeConfig.content?.settingsDatabaseName

    if (typeof explicitName === 'string' && explicitName.trim().length > 0) {
        return explicitName.trim()
    }

    const dbLoginPrefix = runtimeConfig.dbLoginPrefix

    if (!dbLoginPrefix) {
        throw createError({
            statusCode: 500,
            statusMessage: 'Main database prefix (dbLoginPrefix) is not configured'
        })
    }

    return `${dbLoginPrefix}-orders`
}

/**
 * Resolve the settings document id in the main application database.
 */
export function getMainSettingsDocumentId(): string {
    const runtimeConfig = useRuntimeConfig()
    const explicitId = runtimeConfig.content?.settingsDocumentId

    if (typeof explicitId === 'string' && explicitId.trim().length > 0) {
        return explicitId.trim()
    }

    return 'settings'
}
