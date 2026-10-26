import {
  CoreConfigurationError,
  immutableSettingsSnapshot,
} from '../config-schema'
import { resolveSettings } from '../options'
import type { ResolvedOptions } from '../shared/types'
import { createServiceClient, type CouchDBClient } from './client'
export async function loadSettings(
  options: ResolvedOptions,
  client?: CouchDBClient,
) {
  if (!options.config.enabled)
    return immutableSettingsSnapshot(resolveSettings(options))
  let remote: Record<string, string> = {}
  let response: Response | undefined
  try {
    response = await (client ?? createServiceClient()).request(
      `/_node/_local/_config/cf_env_${encodeURIComponent(options.appSlug)}`,
    )
    if (!response.ok) throw new Error(`configuration HTTP ${response.status}`)
  } catch {
    if (options.config.required)
      throw new CoreConfigurationError(
        'Required CouchDB configuration unavailable',
      )
    console.warn(
      '[couchdb] Optional configuration unavailable; using local defaults',
    )
  }
  if (response?.ok) {
    try {
      remote = await response.json()
    } catch {
      throw new CoreConfigurationError('Invalid configuration section')
    }
    if (!remote || typeof remote !== 'object' || Array.isArray(remote))
      throw new CoreConfigurationError('Invalid configuration section')
  }
  return immutableSettingsSnapshot(resolveSettings(options, remote))
}
