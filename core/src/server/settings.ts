import { CoreConfigurationError } from '../config-schema'
import options from '#core-options'
import { createError } from 'h3'
import { loadSettings } from './config-resolver'
import type { ResolvedCouchDBSettings } from '../shared/types'
let snapshot: Promise<ResolvedCouchDBSettings> | undefined
export function getCouchDBSettings(_event?: unknown) {
  snapshot ??= loadSettings(options).catch((error) => {
    throw createError({
      statusCode: 503,
      statusMessage:
        error instanceof CoreConfigurationError
          ? error.message
          : 'CouchDB configuration unavailable',
    })
  })
  return snapshot
}
