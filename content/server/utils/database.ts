import { createError } from 'h3'

/**
 * Resolve the content database name from runtime config, ensuring configuration is present.
 */
export function getContentDatabaseName(): string {
    const runtimeConfig = useRuntimeConfig()
    const dbContentPrefix = runtimeConfig.dbContentPrefix

    if (!dbContentPrefix) {
        throw createError({
            statusCode: 500,
            statusMessage: 'Content database prefix (dbContentPrefix) is not configured'
        })
    }

    return `${dbContentPrefix}-content`
}
