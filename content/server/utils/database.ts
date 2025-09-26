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
