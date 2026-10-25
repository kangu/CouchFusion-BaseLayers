import { randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
export const localBaseUrl = 'http://localhost:5984'
const manifestDirectory = fileURLToPath(
  new URL('../../.test-runs/', import.meta.url),
)
export interface LocalTestConfig {
  auth: string
  httpTimeoutMs: number
  readyTimeoutMs: number
  slowThresholdMs: number
  reportTimings: boolean
  keepFailedResources: boolean
}
type Fetch = typeof globalThis.fetch
export async function readLocalTestConfig(
  options: { env?: Record<string, string | undefined>; fetch?: Fetch } = {},
): Promise<LocalTestConfig> {
  const auth = (options.env ?? process.env).COUCHDB_ADMIN_AUTH
  if (
    !auth ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(auth) ||
    !/^[^:]+:.+$/.test(Buffer.from(auth, 'base64').toString('utf8'))
  )
    throw new Error('COUCHDB_ADMIN_AUTH must contain base64(username:password)')
  let response: Response
  try {
    response = await (options.fetch ?? fetch)(
      `${localBaseUrl}/_node/_local/_config/cf_env_couchdb_tests`,
      {
        headers: { Authorization: `Basic ${auth}` },
        signal: AbortSignal.timeout(3000),
      },
    )
  } catch {
    throw new Error('Local CouchDB configuration request failed')
  }
  if (response.status !== 404 && !response.ok)
    throw new Error(`Local test configuration HTTP ${response.status}`)
  const data = response.status === 404 ? {} : await response.json()
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new Error('Invalid local test configuration section')
  const number = (key: string, fallback: number, min = 100, max = 30000) => {
    const value = data[key] === undefined ? fallback : Number(data[key])
    if (!Number.isInteger(value) || value < min || value > max)
      throw new Error(`Invalid ${key}: expected integer ${min}..${max}`)
    return value
  }
  const bool = (key: string, fallback: boolean) => {
    const value = data[key]
    if (value === undefined) return fallback
    if (value === true || value === 'true') return true
    if (value === false || value === 'false') return false
    throw new Error(`Invalid ${key}: expected boolean`)
  }
  return {
    auth,
    httpTimeoutMs: number('test_http_timeout_ms', 3000),
    readyTimeoutMs: number('test_ready_timeout_ms', 5000),
    slowThresholdMs: number('test_slow_threshold_ms', 1000, 1, 60000),
    reportTimings: bool('test_report_timings', true),
    keepFailedResources: bool('test_keep_failed_resources', false),
  }
}
export type OwnedResource = { kind: 'database' | 'user' | 'config'; id: string }
export function assertOwnedResource(runId: string, resource: OwnedResource) {
  if (!/^[a-f0-9]{24}$/.test(runId)) throw new Error('Invalid run ID')
  if (!['database', 'user', 'config'].includes(resource.kind))
    throw new Error('Invalid resource kind')
  const prefix =
    resource.kind === 'config'
      ? `cf_env_couchdb_test_${runId}`
      : resource.kind === 'user'
        ? `org.couchdb.user:couchdb_test_${runId}`
        : `couchdb_test_${runId}`
  if (resource.id !== prefix && !resource.id.startsWith(prefix + '_'))
    throw new Error('Refusing unowned resource')
  const validatedId =
    resource.kind === 'user'
      ? resource.id.slice('org.couchdb.user:'.length)
      : resource.id
  if (!/^[a-z0-9_:]+$/.test(validatedId)) throw new Error('Invalid resource ID')
}
export function localRequest(
  config: LocalTestConfig,
  path: string,
  init: RequestInit = {},
  operation: { timeoutMs?: number } = {},
) {
  const timeoutMs = operation.timeoutMs ?? config.httpTimeoutMs
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 60000)
    throw new Error('Operation timeout must be an integer 100..60000')
  const headers = new Headers(init.headers)
  if (!headers.has('Authorization') && !headers.has('Cookie'))
    headers.set('Authorization', `Basic ${config.auth}`)
  return fetch(`${localBaseUrl}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  }).catch(() => {
    throw new Error('Local CouchDB request failed')
  })
}
export async function requireOk(response: Response) {
  if (!response.ok) throw new Error(`CouchDB HTTP ${response.status}`)
  return response.json()
}
interface Manifest {
  version: 1
  runId: string
  marker: string
  resources: OwnedResource[]
}
export async function createLocalTestRun(config: LocalTestConfig) {
  const runId = randomBytes(12).toString('hex')
  const marker = `couchdb-test-run:${runId}`
  const manifest: Manifest = { version: 1, runId, marker, resources: [] }
  await mkdir(manifestDirectory, { recursive: true })
  const save = async () => {
    const path = join(manifestDirectory, `${runId}.json`)
    await writeFile(path + '.tmp', JSON.stringify(manifest), { mode: 0o600 })
    await rename(path + '.tmp', path)
  }
  await save()
  return {
    runId,
    marker,
    config,
    async register(resource: OwnedResource) {
      assertOwnedResource(runId, resource)
      if (
        !manifest.resources.some(
          (r) => r.kind === resource.kind && r.id === resource.id,
        )
      ) {
        manifest.resources.push(resource)
        await save()
      }
      return resource.id
    },
    async database(suffix = '') {
      const id = await this.register({
        kind: 'database',
        id: `couchdb_test_${runId}${suffix ? '_' + suffix : ''}`,
      })
      await requireOk(await localRequest(config, `/${id}`, { method: 'PUT' }))
      return id
    },
    async cleanup() {
      await cleanupLocalTestRun(runId, config)
    },
  }
}
export async function cleanupLocalTestRun(
  runId: string,
  suppliedConfig?: LocalTestConfig,
) {
  if (!/^[a-f0-9]{24}$/.test(runId)) throw new Error('Invalid run ID')
  const path = join(manifestDirectory, `${runId}.json`)
  const manifest: Manifest = JSON.parse(await readFile(path, 'utf8'))
  if (
    manifest.version !== 1 ||
    manifest.runId !== runId ||
    manifest.marker !== `couchdb-test-run:${runId}` ||
    !Array.isArray(manifest.resources)
  )
    throw new Error('Invalid ownership manifest')
  for (const resource of manifest.resources)
    assertOwnedResource(runId, resource)
  const config = suppliedConfig ?? (await readLocalTestConfig())
  for (const resource of [...manifest.resources].reverse()) {
    let target =
      resource.kind === 'database'
        ? `/${resource.id}`
        : resource.kind === 'config'
          ? `/_node/_local/_config/${resource.id}`
          : `/_users/${encodeURIComponent(resource.id)}`
    if (resource.kind === 'user') {
      const found = await localRequest(config, target)
      if (found.status === 404) continue
      const doc = await requireOk(found)
      if (doc.testRunMarker !== manifest.marker)
        throw new Error('User ownership marker mismatch')
      target += `?rev=${encodeURIComponent(doc._rev)}`
    }
    if (resource.kind === 'config') {
      const found = await localRequest(config, target)
      if (found.status === 404) continue
      const section = await requireOk(found)
      if (section.test_run_marker !== manifest.marker)
        throw new Error('Configuration ownership marker mismatch')
      for (const key of Object.keys(section).sort(
        (a, b) =>
          Number(a === 'test_run_marker') - Number(b === 'test_run_marker'),
      )) {
        const deleted = await localRequest(
          config,
          `${target}/${encodeURIComponent(key)}`,
          { method: 'DELETE' },
        )
        if (!deleted.ok && deleted.status !== 404)
          throw new Error(`Cleanup HTTP ${deleted.status}`)
      }
      continue
    }
    const deleted = await localRequest(config, target, { method: 'DELETE' })
    if (!deleted.ok && deleted.status !== 404)
      throw new Error(`Cleanup HTTP ${deleted.status}`)
  }
  await unlink(path)
}
export async function poll<T>(
  config: LocalTestConfig,
  action: () => Promise<T>,
  ready: (value: T) => boolean,
): Promise<T> {
  const deadline = Date.now() + config.readyTimeoutMs
  do {
    const value = await action()
    if (ready(value)) return value
    await new Promise((resolve) => setTimeout(resolve, 50))
  } while (Date.now() < deadline)
  throw new Error('Local CouchDB readiness deadline exceeded')
}
