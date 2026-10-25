export const COUCHDB_URL = 'http://localhost:5984'
export interface ClientConfig {
  url?: string
  adminAuth?: string
  fetch?: typeof fetch
  timeout?: number
}
export interface CouchDBClient {
  request(path: string, options?: RequestInit): Promise<Response>
  json<T = any>(path: string, options?: RequestInit): Promise<T>
}
export function getBootstrapConfig(
  env: Record<string, string | undefined> = process.env,
): { url: string; adminAuth: string } {
  const auth = env.COUCHDB_ADMIN_AUTH
  if (
    !auth ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(auth) ||
    !Buffer.from(auth, 'base64').toString().includes(':')
  )
    throw new Error(
      '[couchdb] COUCHDB_ADMIN_AUTH must be base64(username:password)',
    )
  return { url: COUCHDB_URL, adminAuth: auth }
}
function createClient(
  config: ClientConfig,
  identity: HeadersInit,
): CouchDBClient {
  const base = config.url ?? COUCHDB_URL,
    fetcher = config.fetch ?? fetch
  const request = async (path: string, options: RequestInit = {}) => {
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\'))
      throw new Error('[couchdb] Requests require a relative CouchDB path')
    const headers = new Headers(options.headers)
    for (const [key, value] of new Headers(identity)) headers.set(key, value)
    if (options.body && !headers.has('content-type'))
      headers.set('content-type', 'application/json')
    return fetcher(base.replace(/\/$/, '') + path, {
      ...options,
      headers,
      redirect: 'error',
      signal: options.signal ?? AbortSignal.timeout(config.timeout ?? 3000),
    })
  }
  return {
    request,
    async json<T = any>(path: string, options?: RequestInit): Promise<T> {
      const response = await request(path, options)
      if (!response.ok) {
        const error = new Error(
          `[couchdb] ${options?.method ?? 'GET'} operation failed (${response.status})`,
        ) as Error & { statusCode: number }
        error.statusCode = response.status
        throw error
      }
      return response.json() as Promise<T>
    },
  }
}
export function createServiceClient(config: ClientConfig = {}): CouchDBClient {
  const auth = config.adminAuth ?? getBootstrapConfig().adminAuth
  return createClient(config, { Authorization: `Basic ${auth}` })
}
export function createSessionClient(
  config: ClientConfig = {},
  cookie: string,
): CouchDBClient {
  if (!cookie || /[;\r\n]/.test(cookie))
    throw new Error('[couchdb] Invalid caller session')
  return createClient(config, { Cookie: `AuthSession=${cookie}` })
}
