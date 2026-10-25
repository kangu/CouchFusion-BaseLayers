import { resolveSettings } from '../options'
import type { ResolvedOptions } from '../shared/types'
import { createServiceClient, type CouchDBClient } from './client'
export async function loadSettings(
  options: ResolvedOptions,
  client?: CouchDBClient,
) {
  if (!options.config.enabled) return resolveSettings(options)
  let remote: Record<string, string> = {}
  try {
    const response = await (client ?? createServiceClient()).request(
      `/_node/_local/_config/cf_env_${encodeURIComponent(options.appSlug)}`,
    )
    if (!response.ok) throw new Error(`configuration HTTP ${response.status}`)
    remote = await response.json()
    if (!remote || typeof remote !== 'object' || Array.isArray(remote))
      throw new Error('invalid configuration section')
  } catch {
    if (options.config.required)
      throw new Error('[couchdb] Required CouchDB configuration unavailable')
    console.warn(
      '[couchdb] Optional configuration unavailable; using local defaults',
    )
  }
  return resolveSettings(options, remote)
}
