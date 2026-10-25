/** Explicit-client CouchDB operations. No ambient credentials or authentication policy. */
export interface OperationClient {
  request(path: string, options?: RequestInit): Promise<Response>
  json<T>(path: string, options?: RequestInit): Promise<T>
}
export interface CouchDBError {
  error: string
  reason: string
}

export interface CouchDBLoginResult {
  ok: boolean
  setCookie?: string | null
}

export interface CouchDBResponse {
  ok?: boolean
  id?: string
  rev?: string
  error?: string
  reason?: string
}

export interface CouchDBDocument {
  _id: string
  _rev?: string
  [key: string]: any
}

export interface CouchDBBulkDocsResponse {
  id: string
  ok?: boolean
  rev?: string
  error?: string
  reason?: string
}

export interface CouchDBView {
  map: string
  reduce?: string
}

export interface CouchDBDesignDocument extends CouchDBDocument {
  language: string
  views: Record<string, CouchDBView>
}

export interface CouchDBSecurityObject {
  admins: {
    names: string[]
    roles: string[]
  }
  members: {
    names: string[]
    roles: string[]
  }
}

export interface CouchDBDatabaseInfo {
  db_name: string
  doc_count: number
  doc_del_count: number
  update_seq: number
  purge_seq: number
  compact_running: boolean
  disk_size: number
  data_size: number
  instance_start_time: string
  disk_format_version: number
  committed_update_seq: number
}

export interface CouchDBViewQueryParams {
  conflicts?: boolean
  descending?: boolean
  endkey?: any
  end_key?: any
  endkey_docid?: string
  end_key_doc_id?: string
  group?: boolean
  group_level?: number
  include_docs?: boolean
  attachments?: boolean
  att_encoding_info?: boolean
  inclusive_end?: boolean
  key?: any
  keys?: any[]
  limit?: number
  reduce?: boolean
  skip?: number
  sorted?: boolean
  stable?: boolean
  stale?: string
  startkey?: any
  start_key?: any
  startkey_docid?: string
  start_key_doc_id?: string
  update?: string
  update_seq?: boolean
}

export interface CouchDBViewRow {
  id?: string
  key: any
  value: any
  doc?: CouchDBDocument
}

export interface CouchDBViewResponse {
  total_rows?: number
  offset?: number
  rows: CouchDBViewRow[]
  update_seq?: string
}

export interface CouchDBUserDocument extends CouchDBDocument {
  name: string
  password?: string
  type: 'user'
  roles: string[]
  derived_key?: string
  password_scheme?: string
  salt?: string
  iterations?: number
}

export interface CouchDBSessionResponse {
  ok: boolean
  userCtx: {
    name: string | null
    roles: string[]
  }
  info?: {
    authentication_db?: string
    authentication_handlers?: string[]
    authenticated?: string
  }
}

export interface CreateUserPayload {
  [key: string]: any
}

export interface CouchDBAttachment {
  content_type: string
  data?: string
  stub?: boolean
  length?: number
  revpos?: number
}
export interface CouchDBDocumentWithAttachments extends CouchDBDocument {
  _attachments?: Record<string, CouchDBAttachment>
}
const enc = encodeURIComponent
const dbPath = (db: string) => `/${enc(db)}`
const docPath = (db: string, id: string) =>
  `${dbPath(db)}/${id.startsWith('_design/') || id.startsWith('_local/') ? id.slice(0, id.indexOf('/') + 1) + enc(id.slice(id.indexOf('/') + 1)) : enc(id)}`
const body = (method: string, value: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(value),
})
export class CouchDBOperationError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
  ) {
    super(`CouchDB request failed (${status}): ${detail}`)
  }
}
async function checked(response: Response): Promise<Response> {
  if (!response.ok)
    throw new CouchDBOperationError(response.status, await response.text())
  return response
}
async function json<T>(
  client: OperationClient,
  path: string,
  init?: RequestInit,
): Promise<T> {
  return (await checked(await client.request(path, init))).json() as Promise<T>
}
export async function getDocument<T extends CouchDBDocument = CouchDBDocument>(
  client: OperationClient,
  db: string,
  id: string,
): Promise<T | null> {
  const response = await client.request(docPath(db, id))
  return response.status === 404
    ? null
    : ((await checked(response)).json() as Promise<T>)
}
export const getLocalDocument = <T extends CouchDBDocument = CouchDBDocument>(
  client: OperationClient,
  db: string,
  id: string,
) => getDocument<T>(client, db, `_local/${id.replace(/^_local\//, '')}`)
export const putDocument = <T extends CouchDBDocument>(
  client: OperationClient,
  db: string,
  doc: T,
): Promise<CouchDBResponse> =>
  json(client, docPath(db, doc._id), body('PUT', doc))
export const putLocalDocument = <T extends CouchDBDocument>(
  client: OperationClient,
  db: string,
  doc: T,
) =>
  putDocument(client, db, {
    ...doc,
    _id: `_local/${doc._id.replace(/^_local\//, '')}`,
  })
export const deleteDocument = (
  client: OperationClient,
  db: string,
  id: string,
  rev: string,
): Promise<CouchDBResponse> =>
  json(client, `${docPath(db, id)}?rev=${enc(rev)}`, { method: 'DELETE' })
export const deleteLocalDocument = (
  client: OperationClient,
  db: string,
  id: string,
  rev: string,
) => deleteDocument(client, db, `_local/${id.replace(/^_local\//, '')}`, rev)
export async function getDocumentWithAttachments<
  T extends CouchDBDocumentWithAttachments = CouchDBDocumentWithAttachments,
>(
  client: OperationClient,
  db: string,
  id: string,
  inline = false,
): Promise<T | null> {
  const response = await client.request(
    `${docPath(db, id)}${inline ? '?attachments=true&att_encoding_info=true' : ''}`,
  )
  return response.status === 404
    ? null
    : ((await checked(response)).json() as Promise<T>)
}
export const bulkDocs = <T extends CouchDBDocument>(
  client: OperationClient,
  db: string,
  docs: T[],
  newEdits = true,
): Promise<CouchDBBulkDocsResponse[]> =>
  json(
    client,
    `${dbPath(db)}/_bulk_docs`,
    body('POST', { docs, new_edits: newEdits }),
  )
function queryPath(path: string, options: CouchDBViewQueryParams): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(options))
    if (key !== 'keys' && value !== undefined)
      params.set(
        key,
        ['key', 'startkey', 'endkey', 'start_key', 'end_key'].includes(key)
          ? JSON.stringify(value)
          : String(value),
      )
  return params.size ? `${path}?${params}` : path
}
export const getAllDocs = (
  client: OperationClient,
  db: string,
  options: CouchDBViewQueryParams = {},
): Promise<CouchDBViewResponse> =>
  json(
    client,
    queryPath(`${dbPath(db)}/_all_docs`, options),
    body('POST', options.keys ? { keys: options.keys } : {}),
  )
export const getView = (
  client: OperationClient,
  db: string,
  design: string,
  view: string,
  options: CouchDBViewQueryParams = {},
): Promise<CouchDBViewResponse> =>
  json(
    client,
    queryPath(
      `${dbPath(db)}/_design/${enc(design.replace(/^_design\//, ''))}/_view/${enc(view)}`,
      options,
    ),
    body('POST', options.keys ? { keys: options.keys } : {}),
  )
export const getDatabaseInfo = (
  client: OperationClient,
  db: string,
): Promise<CouchDBDatabaseInfo> => json(client, dbPath(db))
export async function createDatabase(
  client: OperationClient,
  db: string,
): Promise<boolean> {
  const response = await client.request(dbPath(db), { method: 'PUT' })
  if (response.status !== 412) await checked(response)
  return true
}
export const getDatabaseSecurity = (
  client: OperationClient,
  db: string,
): Promise<CouchDBSecurityObject> => json(client, `${dbPath(db)}/_security`)
export async function setDatabaseSecurity(
  client: OperationClient,
  db: string,
  security: CouchDBSecurityObject,
): Promise<void> {
  await checked(
    await client.request(`${dbPath(db)}/_security`, body('PUT', security)),
  )
}
export async function createOrUpdateDesignDocument(
  client: OperationClient,
  db: string,
  doc: CouchDBDesignDocument,
): Promise<CouchDBResponse> {
  const id = `_design/${doc._id.replace(/^_design\//, '')}`
  const existing = await getDocument(client, db, id)
  return putDocument(client, db, {
    ...doc,
    _id: id,
    ...(existing?._rev ? { _rev: existing._rev } : {}),
  })
}
/** Explicit provisioning only; callers must supply a deliberate security policy. */
export async function initializeDatabase(
  client: OperationClient,
  db: string,
  security: CouchDBSecurityObject,
  designs: CouchDBDesignDocument[] = [],
): Promise<void> {
  await createDatabase(client, db)
  await setDatabaseSecurity(client, db, security)
  for (const design of designs)
    await createOrUpdateDesignDocument(client, db, design)
}
export const getAttachment = async (
  client: OperationClient,
  db: string,
  id: string,
  name: string,
): Promise<Response> =>
  checked(await client.request(`${docPath(db, id)}/${enc(name)}`))
export const putAttachment = (
  client: OperationClient,
  db: string,
  id: string,
  name: string,
  data: BodyInit,
  contentType: string,
  rev?: string,
): Promise<CouchDBResponse> =>
  json(
    client,
    `${docPath(db, id)}/${enc(name)}${rev ? `?rev=${enc(rev)}` : ''}`,
    { method: 'PUT', headers: { 'Content-Type': contentType }, body: data },
  )
export const deleteAttachment = (
  client: OperationClient,
  db: string,
  id: string,
  name: string,
  rev: string,
): Promise<CouchDBResponse> =>
  json(client, `${docPath(db, id)}/${enc(name)}?rev=${enc(rev)}`, {
    method: 'DELETE',
  })
export const testDatabaseConnection = async (
  client: OperationClient,
): Promise<boolean> => (await client.request('/')).ok
