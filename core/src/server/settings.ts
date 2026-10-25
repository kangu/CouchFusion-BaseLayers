import options from '#core-options'
import { createError } from 'h3'
import { loadSettings } from './config-resolver'
import type { ResolvedCouchDBSettings } from '../shared/types'
let snapshot: Promise<ResolvedCouchDBSettings> | undefined
export function getCouchDBSettings(_event?: unknown) {
  snapshot ??= loadSettings(options)
    .then((settings) =>
      Object.freeze({ ...settings, appSlug: options.appSlug }),
    )
    .catch(() => {
      throw createError({
        statusCode: 503,
        statusMessage: 'CouchDB configuration unavailable',
      })
    })
  return snapshot
}
