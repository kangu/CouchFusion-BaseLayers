import { randomUUID } from 'node:crypto'
import {
  initializeDatabase,
  couchDBRequest,
  bulkDocs,
  createUser as couchCreateUser,
  authenticate,
  type CouchDBConfig,
  type CouchDBDesignDocument,
  type CouchDBDocument,
  type CouchDBBulkDocsResponse,
  type CreateUserPayload,
} from '../../database/utils/couchdb'

type ResolvedCouchConfig = Required<CouchDBConfig>

const DEFAULT_TEST_PREFIX = process.env.TEST_DB_PREFIX || 'test'
const DEFAULT_COUCH_URL = process.env.COUCHDB_URL || 'http://localhost:5984'

const sanitizeSegment = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

const createRunId = (): string => randomUUID().replace(/[^a-z0-9]/gi, '').substring(0, 12).toLowerCase()

const resolveConfig = (config?: CouchDBConfig): ResolvedCouchConfig => {
  const baseUrl = config?.baseUrl || DEFAULT_COUCH_URL
  const adminAuth =
    config?.adminAuth ||
    process.env.COUCHDB_ADMIN_AUTH ||
    process.env.NUXT_COUCHDB_ADMIN_AUTH

  if (!adminAuth) {
    throw new Error(
      'CouchDB admin credentials missing. Provide config.adminAuth or set COUCHDB_ADMIN_AUTH/NUXT_COUCHDB_ADMIN_AUTH.'
    )
  }

  return { baseUrl, adminAuth }
}

const buildLoginPrefix = (namespace: string, runId: string, prefix: string = DEFAULT_TEST_PREFIX) => {
  const root = sanitizeSegment(prefix || DEFAULT_TEST_PREFIX)
  const scope = sanitizeSegment(namespace)
  return [root, scope, runId].filter(Boolean).join('-')
}

const buildDatabaseName = (loginPrefix: string, suffix: string): string =>
  `${loginPrefix}-${sanitizeSegment(suffix)}`

const dropDatabase = async (databaseName: string, config: ResolvedCouchConfig) => {
  const response = await couchDBRequest(
    `${config.baseUrl}/${databaseName}`,
    { method: 'DELETE' },
    config
  )

  if (!response.ok && response.status !== 404) {
    const body = await response.text().catch(() => '')
    throw new Error(`Failed to drop database ${databaseName}: ${response.status} ${body}`)
  }
}

const deleteUser = async (username: string, config: ResolvedCouchConfig) => {
  const userId = `org.couchdb.user:${username}`
  const lookup = await couchDBRequest(
    `${config.baseUrl}/_users/${encodeURIComponent(userId)}`,
    {},
    config
  )

  if (lookup.status === 404) {
    return
  }

  if (!lookup.ok) {
    const body = await lookup.text().catch(() => '')
    throw new Error(`Failed to load user ${username}: ${lookup.status} ${body}`)
  }

  const doc = await lookup.json().catch(() => null)
  const revision = doc?._rev

  if (!revision) {
    return
  }

  const response = await couchDBRequest(
    `${config.baseUrl}/_users/${encodeURIComponent(userId)}?rev=${encodeURIComponent(revision)}`,
    { method: 'DELETE' },
    config
  )

  if (!response.ok && response.status !== 404) {
    const body = await response.text().catch(() => '')
    throw new Error(`Failed to delete user ${username}: ${response.status} ${body}`)
  }
}

export interface CouchTestHarnessOptions {
  namespace: string
  databaseSuffix: string
  designDocuments?: CouchDBDesignDocument[]
  prefix?: string
  config?: CouchDBConfig
}

export interface TestUserOptions {
  username?: string
  password?: string
  roles?: string[]
  payload?: CreateUserPayload
  authenticate?: boolean
}

export interface TestUserCredentials {
  username: string
  password: string
  roles: string[]
  setCookie?: string | null
}

export interface CouchTestContext {
  runId: string
  loginPrefix: string
  databaseName: string
  config: ResolvedCouchConfig
}

export interface CouchTestHarness {
  setup: () => Promise<CouchTestContext>
  teardown: () => Promise<void>
  getContext: () => CouchTestContext
  seedDocuments: <T extends CouchDBDocument>(docs: T[]) => Promise<CouchDBBulkDocsResponse[]>
  createUser: (options?: TestUserOptions) => Promise<TestUserCredentials>
  registerCleanup: (handler: () => void | Promise<void>) => void
  readonly loginPrefix: string | null
  readonly databaseName: string | null
}

export const createCouchTestHarness = (
  options: CouchTestHarnessOptions
): CouchTestHarness => {
  const cleanupTasks: Array<() => void | Promise<void>> = []
  let context: CouchTestContext | null = null
  let isSetup = false

  const resolveContext = () => {
    if (!context) {
      throw new Error('Couch test harness has not been initialised. Call setup() first.')
    }
    return context
  }

  const seedDocuments = async <T extends CouchDBDocument>(docs: T[]) => {
    if (!docs.length) {
      return []
    }

    const ctx = resolveContext()
    return bulkDocs(ctx.databaseName, docs, ctx.config)
  }

  const createUser = async (userOptions: TestUserOptions = {}): Promise<TestUserCredentials> => {
    const ctx = resolveContext()
    const runId = createRunId()
    const username =
      userOptions.username ||
      `${ctx.loginPrefix}-${sanitizeSegment(options.namespace)}-user-${runId}`
    const password = userOptions.password || `pass-${runId}`
    const roles = userOptions.roles || []

    await couchCreateUser(username, password, userOptions.payload, roles, ctx.config)

    cleanupTasks.push(() => deleteUser(username, ctx.config))

    let setCookie: string | null | undefined = null
    if (userOptions.authenticate !== false) {
      const result = await authenticate(username, password, ctx.config)
      setCookie = result.setCookie ?? null
    }

    return { username, password, roles, setCookie }
  }

  const setup = async (): Promise<CouchTestContext> => {
    if (isSetup && context) {
      return context
    }

    const config = resolveConfig(options.config)
    const runId = createRunId()
    const loginPrefix = buildLoginPrefix(options.namespace, runId, options.prefix)
    const databaseName = buildDatabaseName(loginPrefix, options.databaseSuffix)
    const designDocuments = options.designDocuments || []

    await initializeDatabase(databaseName, designDocuments, config)

    context = {
      runId,
      loginPrefix,
      databaseName,
      config,
    }

    isSetup = true
    return context
  }

  const teardown = async () => {
    if (!isSetup || !context) {
      return
    }

    // Execute registered cleanup tasks (LIFO)
    while (cleanupTasks.length) {
      const task = cleanupTasks.pop()
      try {
        await task?.()
      } catch (error) {
        console.warn('[couch-test] cleanup task failed', error)
      }
    }

    await dropDatabase(context.databaseName, context.config)
    context = null
    isSetup = false
  }

  const registerCleanup = (handler: () => void | Promise<void>) => {
    cleanupTasks.push(handler)
  }

  return {
    setup,
    teardown,
    getContext: resolveContext,
    seedDocuments,
    createUser,
    registerCleanup,
    get loginPrefix() {
      return context?.loginPrefix ?? null
    },
    get databaseName() {
      return context?.databaseName ?? null
    },
  }
}
