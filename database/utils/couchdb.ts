/**
 * CouchDB utilities for the auth layer
 * Server-side only - provides authenticated CouchDB operations
 */

import crypto from 'crypto'

// Type definitions
export interface CouchDBError {
  error: string;
  reason: string;
}

export interface CouchDBLoginResult {
    ok: boolean
    setCookie?: string | null;
}

export interface CouchDBResponse {
  ok?: boolean;
  id?: string;
  rev?: string;
  error?: string;
  reason?: string;
}

export interface CouchDBDocument {
  _id: string;
  _rev?: string;
  [key: string]: any;
}

export interface CouchDBBulkDocsResponse {
  id: string;
  ok?: boolean;
  rev?: string;
  error?: string;
  reason?: string;
}

export interface CouchDBView {
  map: string;
  reduce?: string;
}

export interface CouchDBDesignDocument extends CouchDBDocument {
  language: string;
  views: Record<string, CouchDBView>;
}

export interface CouchDBSecurityObject {
  admins: {
    names: string[];
    roles: string[];
  };
  members: {
    names: string[];
    roles: string[];
  };
}

export interface CouchDBDatabaseInfo {
  db_name: string;
  doc_count: number;
  doc_del_count: number;
  update_seq: number;
  purge_seq: number;
  compact_running: boolean;
  disk_size: number;
  data_size: number;
  instance_start_time: string;
  disk_format_version: number;
  committed_update_seq: number;
}

export interface CouchDBViewQueryParams {
  conflicts?: boolean;
  descending?: boolean;
  endkey?: any;
  end_key?: any;
  endkey_docid?: string;
  end_key_doc_id?: string;
  group?: boolean;
  group_level?: number;
  include_docs?: boolean;
  attachments?: boolean;
  att_encoding_info?: boolean;
  inclusive_end?: boolean;
  key?: any;
  keys?: any[];
  limit?: number;
  reduce?: boolean;
  skip?: number;
  sorted?: boolean;
  stable?: boolean;
  stale?: string;
  startkey?: any;
  start_key?: any;
  startkey_docid?: string;
  start_key_doc_id?: string;
  update?: string;
  update_seq?: boolean;
}

export interface CouchDBViewRow {
  id?: string;
  key: any;
  value: any;
  doc?: CouchDBDocument;
}

export interface CouchDBViewResponse {
  total_rows?: number;
  offset?: number;
  rows: CouchDBViewRow[];
  update_seq?: string;
}

export interface CouchDBUserDocument extends CouchDBDocument {
  name: string;
  password?: string;
  type: 'user';
  roles: string[];
  derived_key?: string;
  password_scheme?: string;
  salt?: string;
  iterations?: number;
}

export interface CouchDBSessionResponse {
  ok: boolean;
  userCtx: {
    name: string | null;
    roles: string[];
  };
  info?: {
    authentication_db?: string;
    authentication_handlers?: string[];
    authenticated?: string;
  };
}

export interface CreateUserPayload {
  [key: string]: any;
}

// Configuration
export interface CouchDBConfig {
  baseUrl?: string;
  adminAuth?: string;
}

const DEFAULT_COUCHDB_URL = 'http://localhost:5984';

/**
 * Get CouchDB configuration from environment or parameters
 */
function getCouchDBConfig(config?: CouchDBConfig): Required<CouchDBConfig> {
  const baseUrl = config?.baseUrl || process.env.COUCHDB_URL || DEFAULT_COUCHDB_URL;
  const adminAuth = config?.adminAuth || process.env.COUCHDB_ADMIN_AUTH;

  if (!adminAuth) {
    throw new Error('COUCHDB_ADMIN_AUTH environment variable is required but not set');
  }

  return { baseUrl, adminAuth };
}

/**
 * Make authenticated request to CouchDB
 */
export async function couchDBRequest(
  url: string,
  options: RequestInit = {},
  config?: CouchDBConfig
): Promise<Response> {
  const { adminAuth } = getCouchDBConfig(config);

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Basic ${adminAuth}`,
    ...options.headers
  };

  return fetch(url, {
    ...options,
    headers
  });
}

/**
 * Test connection to a specific CouchDB database
 */
export async function testDatabaseConnection(
  databaseName: string,
  config?: CouchDBConfig
): Promise<boolean> {
  try {
    const { baseUrl } = getCouchDBConfig(config);
    const response = await couchDBRequest(`${baseUrl}/${databaseName}`, {}, config);
    return response.ok;
  } catch (error) {
    console.warn(`Failed to connect to database ${databaseName}:`, error);
    return false;
  }
}

/**
 * Create a CouchDB database
 */
export async function createDatabase(
  databaseName: string,
  config?: CouchDBConfig
): Promise<boolean> {
  try {
    const { baseUrl } = getCouchDBConfig(config);
    const response = await couchDBRequest(
      `${baseUrl}/${databaseName}`,
      { method: 'PUT' },
      config
    );

    if (response.status === 201) {
      console.log(`✅ Database created successfully: ${databaseName}`);
      return true;
    } else if (response.status === 412) {
      console.log(`ℹ️ Database already exists: ${databaseName}`);
      return true;
    } else {
      const errorData: CouchDBError = await response.json();
      throw new Error(`CouchDB database creation error: ${errorData.error} - ${errorData.reason}`);
    }
  } catch (error) {
    console.error(`Failed to create database ${databaseName}:`, error);
    throw error;
  }
}

/**
 * Get default security settings for a database
 */
export function getDefaultDatabaseSecurity(): CouchDBSecurityObject {
  return {
    admins: {
      names: [],
      roles: ['_admin']
    },
    members: {
      names: [],
      roles: [] // Open read/write for all authenticated users
    }
  };
}

/**
 * Set security settings for a CouchDB database
 */
export async function setDatabaseSecurity(
  databaseName: string,
  securityObject: CouchDBSecurityObject,
  config?: CouchDBConfig
): Promise<void> {
  try {
    const { baseUrl } = getCouchDBConfig(config);
    const response = await couchDBRequest(
      `${baseUrl}/${databaseName}/_security`,
      {
        method: 'PUT',
        body: JSON.stringify(securityObject)
      },
      config
    );

    if (!response.ok) {
      const errorData: CouchDBError = await response.json();
      throw new Error(`CouchDB security update error: ${errorData.error} - ${errorData.reason}`);
    }

    console.log(`🔒 Security settings updated for database: ${databaseName}`);
  } catch (error) {
    console.error(`Failed to set security for database ${databaseName}:`, error);
    throw error;
  }
}

/**
 * Get a document from a database
 */
export async function getDocument<T extends CouchDBDocument = CouchDBDocument>(
  databaseName: string,
  documentId: string,
  config?: CouchDBConfig
): Promise<T | null> {
  try {
    const { baseUrl } = getCouchDBConfig(config);
    const response = await couchDBRequest(
      `${baseUrl}/${databaseName}/${encodeURIComponent(documentId)}`,
      {},
      config
    );

    if (response.ok) {
      return await response.json() as T;
    }

    return null;
  } catch (error) {
    console.warn(`Failed to get document: ${documentId}`, error);
    return null;
  }
}

/**
 * Query a CouchDB view using POST method with query parameters in JSON body
 *
 * @param databaseName - The name of the CouchDB database
 * @param designDocName - The design document name (with or without '_design/' prefix)
 * @param viewName - The name of the view within the design document
 * @param queryParams - Optional query parameters (limit, skip, include_docs, etc.)
 * @param config - Optional CouchDB configuration
 * @returns Promise that resolves to view response or null if not found
 *
 * @example
 * ```typescript
 * // Query view with parameters
 * const result = await getView('mydb', 'auth', 'has_account', {
 *   key: 'user@example.com',
 *   include_docs: true,
 *   limit: 10
 * });
 *
 * // Simple view query
 * const allUsers = await getView('mydb', '_design/auth', 'has_account');
 * ```
 */
export async function getView(
  databaseName: string,
  designDocName: string,
  viewName: string,
  queryParams?: CouchDBViewQueryParams,
  config?: CouchDBConfig
): Promise<CouchDBViewResponse | null> {
  try {
    const { baseUrl } = getCouchDBConfig(config);
    const cleanDesignDocName = designDocName.startsWith('_design/')
      ? designDocName.slice(8)
      : designDocName;

    const url = `${baseUrl}/${databaseName}/_design/${encodeURIComponent(cleanDesignDocName)}/_view/${encodeURIComponent(viewName)}`;

    const response = await couchDBRequest(
      url,
      {
        method: 'POST',
        body: queryParams ? JSON.stringify(queryParams) : '{}'
      },
      config
    );

    if (response.ok) {
      return await response.json() as CouchDBViewResponse;
    }

    if (response.status === 404) {
      return null;
    }

    const error: CouchDBError = await response.json();
    throw new Error(`CouchDB view query error: ${error.error} - ${error.reason}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('CouchDB view query error')) {
      throw error;
    }
    console.warn(`Failed to query view: ${designDocName}/${viewName}`, error);
    return null;
  }
}

/**
 * Query all documents in a CouchDB database using POST method with query parameters in JSON body
 * This function uses the _all_docs endpoint which returns all documents in the database
 *
 * @param databaseName - The name of the CouchDB database
 * @param queryParams - Optional query parameters (keys, limit, skip, include_docs, etc.)
 * @param config - Optional CouchDB configuration
 * @returns Promise that resolves to all documents response or null if not found
 *
 * @example
 * ```typescript
 * // Get all documents with full document content
 * const allDocs = await getAllDocs('mydb', {
 *   include_docs: true,
 *   limit: 100
 * });
 *
 * // Get specific documents by keys
 * const specificDocs = await getAllDocs('mydb', {
 *   keys: ['doc1', 'doc2', 'doc3'],
 *   include_docs: true
 * });
 *
 * // Get documents with pagination
 * const pagedDocs = await getAllDocs('mydb', {
 *   startkey: 'a',
 *   endkey: 'z',
 *   limit: 50,
 *   skip: 10
 * });
 * ```
 */
export async function getAllDocs(
  databaseName: string,
  queryParams?: CouchDBViewQueryParams,
  config?: CouchDBConfig
): Promise<CouchDBViewResponse | null> {
  try {
    const { baseUrl } = getCouchDBConfig(config);
    const url = `${baseUrl}/${databaseName}/_all_docs`;

    const response = await couchDBRequest(
      url,
      {
        method: 'POST',
        body: queryParams ? JSON.stringify(queryParams) : '{}'
      },
      config
    );

    if (response.ok) {
      return await response.json() as CouchDBViewResponse;
    }

    if (response.status === 404) {
      return null;
    }

    const error: CouchDBError = await response.json();
    throw new Error(`CouchDB _all_docs query error: ${error.error} - ${error.reason}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('CouchDB _all_docs query error')) {
      throw error;
    }
    console.warn(`Failed to query _all_docs for database: ${databaseName}`, error);
    return null;
  }
}

/**
 * Create a new user in CouchDB's _users database
 *
 * @param username - The username for the new user
 * @param password - Plain text password (will be hashed by CouchDB)
 * @param payload - Optional additional user data to merge with required fields
 * @param roles - Optional array of roles for the user
 * @param config - Optional CouchDB configuration
 * @returns Promise that resolves to the created user document response
 *
 * @example
 * ```typescript
 * // Create basic user
 * const result = await createUser('john', 'password123');
 *
 * // Create user with roles and additional data
 * const result = await createUser('admin', 'secret',
 *   { email: 'admin@example.com', fullName: 'Admin User' },
 *   ['admin', 'moderator']
 * );
 * ```
 */
export async function createUser(
  username: string,
  password: string,
  payload?: CreateUserPayload,
  roles?: string[],
  config?: CouchDBConfig
): Promise<CouchDBResponse> {
  const { baseUrl } = getCouchDBConfig(config);

  const userDoc: CouchDBUserDocument = {
    _id: `org.couchdb.user:${username}`,
    name: username,
    password,
    type: 'user',
    roles: roles || [],
    iterations: 10,
    pbkdf2_prf: 'sha',
    password_scheme: 'simple',
    ...payload
  };

  const response = await couchDBRequest(
    `${baseUrl}/_users/${encodeURIComponent(userDoc._id)}`,
    {
      method: 'PUT',
      body: JSON.stringify(userDoc)
    },
    config
  );

  if (!response.ok) {
    const error: CouchDBError = await response.json();
    throw new Error(`CouchDB user creation error: ${error.error} - ${error.reason}`);
  }

  return await response.json() as CouchDBResponse;
}

/**
 * Create or update a document in a database
 */
export async function putDocument<T extends CouchDBDocument>(
  databaseName: string,
  document: T,
  config?: CouchDBConfig
): Promise<CouchDBResponse> {
  const { baseUrl } = getCouchDBConfig(config);

  const response = await couchDBRequest(
    `${baseUrl}/${databaseName}/${encodeURIComponent(document._id)}`,
    {
      method: 'PUT',
      body: JSON.stringify(document)
    },
    config
  );

  if (!response.ok) {
    const error: CouchDBError = await response.json();
    throw new Error(`CouchDB error: ${error.error} - ${error.reason}`);
  }

  return await response.json() as CouchDBResponse;
}

/**
 * Delete a document from a database
 */
export async function deleteDocument(
  databaseName: string,
  documentId: string,
  revision: string,
  config?: CouchDBConfig
): Promise<CouchDBResponse> {
  const { baseUrl } = getCouchDBConfig(config)

  const response = await couchDBRequest(
    `${baseUrl}/${databaseName}/${encodeURIComponent(documentId)}?rev=${encodeURIComponent(revision)}`,
    {
      method: 'DELETE'
    },
    config
  )

  if (!response.ok) {
    const error: CouchDBError = await response.json()
    throw new Error(`CouchDB delete error: ${error.error} - ${error.reason}`)
  }

  return await response.json() as CouchDBResponse
}

/**
 * Persist multiple documents in a single bulk request
 */
export async function bulkDocs<T extends CouchDBDocument>(
  databaseName: string,
  documents: T[],
  config?: CouchDBConfig
): Promise<CouchDBBulkDocsResponse[]> {
  const { baseUrl } = getCouchDBConfig(config)

  const response = await couchDBRequest(
    `${baseUrl}/${databaseName}/_bulk_docs`,
    {
      method: 'POST',
      body: JSON.stringify({ docs: documents })
    },
    config
  )

  if (!response.ok) {
    const error: CouchDBError = await response.json()
    throw new Error(`CouchDB bulkDocs error: ${error.error} - ${error.reason}`)
  }

  return await response.json() as CouchDBBulkDocsResponse[]
}

/**
 * Compare two CouchDB documents for equality, excluding _rev field
 */
function documentsAreIdentical(doc1: CouchDBDocument, doc2: CouchDBDocument): boolean {
  // Create copies without _rev field for comparison
  const doc1Copy = { ...doc1 };
  const doc2Copy = { ...doc2 };
  delete doc1Copy._rev;
  delete doc2Copy._rev;

  // Use JSON serialization for deep comparison
  return JSON.stringify(doc1Copy) === JSON.stringify(doc2Copy);
}

/**
 * Create or update a design document in a database
 */
export async function createOrUpdateDesignDocument(
  databaseName: string,
  designDocument: CouchDBDesignDocument,
  config?: CouchDBConfig
): Promise<CouchDBResponse> {
  console.log(`📄 Processing design document: ${designDocument._id}`);

  try {
    // Check if document exists and get current revision
    const existingDoc = await getDocument<CouchDBDesignDocument>(
      databaseName,
      designDocument._id,
      config
    );

    if (existingDoc) {
      // Check if documents are identical (excluding _rev)
      if (documentsAreIdentical(existingDoc, designDocument)) {
        console.log(`📄 Design document identical, no need for update: ${designDocument._id}`);
        return {
          ok: true,
          id: designDocument._id,
          rev: existingDoc._rev
        };
      }

      designDocument._rev = existingDoc._rev;
      console.log(`📄 Updating existing design document: ${designDocument._id}`);
    } else {
      console.log(`📄 Creating new design document: ${designDocument._id}`);
    }

    const result = await putDocument(databaseName, designDocument, config);
    console.log(`✅ Design document processed successfully: ${designDocument._id}`);

    return result;
  } catch (error) {
    console.error(`❌ Failed to create/update design document ${designDocument._id}:`, error);
    throw error;
  }
}

/**
 * Initialize a database with multiple design documents
 */
export async function initializeDatabase(
  databaseName: string,
  designDocuments: CouchDBDesignDocument[],
  config?: CouchDBConfig
): Promise<void> {
  console.log(`🔧 Initializing database: ${databaseName}`);

  try {
    // Step 1: Check if database exists
    const exists = await testDatabaseConnection(databaseName, config);

    if (!exists) {
      // Step 2: Create database if it doesn't exist
      console.log(`📦 Creating database: ${databaseName}`);
      await createDatabase(databaseName, config);

      // Step 3: Set default security settings
      console.log(`🔒 Setting security for database: ${databaseName}`);
      await setDatabaseSecurity(databaseName, getDefaultDatabaseSecurity(), config);
    } else {
      console.log(`ℹ️ Database already exists: ${databaseName}`);
    }

    // Step 4: Process design documents
    for (const designDoc of designDocuments) {
      await createOrUpdateDesignDocument(databaseName, designDoc, config);
    }

    console.log(`🎉 Database initialization completed: ${databaseName}`);
  } catch (error) {
    console.error(`💥 Database initialization failed for ${databaseName}:`, error);
    throw error;
  }
}

/**
 * Validate CouchDB environment configuration
 */
export interface CouchDBEnvironmentOptions {
  adminAuth?: string | null
  cookieSecret?: string | null
  strict?: boolean
}

export function validateCouchDBEnvironment(options: CouchDBEnvironmentOptions = {}): void {
  const adminAuth =
    options.adminAuth ??
    process.env.NUXT_COUCHDB_ADMIN_AUTH ??
    process.env.COUCHDB_ADMIN_AUTH

  if (!adminAuth) {
    const message = `
🚨 CouchDB Configuration Warning:
COUCHDB_ADMIN_AUTH (or NUXT_COUCHDB_ADMIN_AUTH) is not defined. Database initialization will be skipped.
    `.trim()

    if (options.strict) {
      throw new Error(message)
    } else {
      console.warn(message)
      return
    }
  }

  try {
    const decoded = Buffer.from(adminAuth, 'base64').toString('utf-8')
    if (!decoded.includes(':')) {
      throw new Error('Invalid format')
    }
  } catch (error) {
    const message = `
🚨 CouchDB Configuration Error:
COUCHDB_ADMIN_AUTH must be base64("username:password").
    `.trim()

    if (options.strict) {
      throw new Error(message)
    } else {
      console.warn(message)
    }
  }

  const cookieSecret =
    options.cookieSecret ??
    process.env.NUXT_COUCHDB_COOKIE_SECRET ??
    process.env.COUCHDB_COOKIE_SECRET

  if (!cookieSecret) {
    const message = `
🚨 CouchDB Configuration Warning:
COUCHDB_COOKIE_SECRET (or NUXT_COUCHDB_COOKIE_SECRET) is not defined. Session generation may fail at runtime.
    `.trim()

    if (options.strict) {
      throw new Error(message)
    } else {
      console.warn(message)
    }
  }
}

/**
 * Authenticate with CouchDB using username and password
 * Makes a POST request to _session API and returns AuthSession cookie on success
 *
 * @param username - The username for authentication
 * @param password - The password for authentication
 * @param config - Optional CouchDB configuration
 * @returns Promise that resolves to AuthSession cookie value or empty string on failure
 *
 * @example
 * ```typescript
 * const sessionCookie = await authenticate('john', 'password123');
 * if (sessionCookie) {
 *   console.log('Authentication successful');
 * } else {
 *   console.log('Authentication failed');
 * }
 * ```
 */
export async function authenticate(
  username: string,
  password: string,
  config?: CouchDBConfig
): Promise<CouchDBLoginResult> {
  try {
    const { baseUrl } = getCouchDBConfig(config);

    // Create form data for authentication
    const formData = new URLSearchParams();
    formData.append('name', username);
    formData.append('password', password);
    console.log('Authorize request for', username, 'with password')

    const response = await fetch(`${baseUrl}/_session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });

    console.log('_session response:', response);
    if (response.ok) {
      // Extract AuthSession cookie from Set-Cookie header
      // not anymore
      // just return the it so it can be set
      return { ok: true, setCookie: response.headers.get('set-cookie') }
/*
      // keep this code here commented as I might want to use it later
      const setCookieHeader = response.headers.get('set-cookie');
      if (setCookieHeader) {
        const cookies = setCookieHeader.split(',');
        for (const cookie of cookies) {
          const trimmedCookie = cookie.trim();
          if (trimmedCookie.startsWith('AuthSession=')) {
            // Extract just the cookie value (everything after 'AuthSession=' and before the first semicolon)
            const authSessionMatch = trimmedCookie.match(/^AuthSession=([^;]+)/);
            if (authSessionMatch) {
              return authSessionMatch[1];
            }
          }
        }
      }
*/
    }

    return { ok: false };
  } catch (error) {
    console.warn('Authentication failed:', error);
    return { ok: false };
  }
}

/**
 * Get current session information from CouchDB
 * Makes a GET request to _session API with either AuthSession cookie or Basic auth
 *
 * @param authOptions - Either { authSessionCookie: string } or { basicAuthToken: string }
 * @param config - Optional CouchDB configuration
 * @returns Promise that resolves to session response or null on failure
 *
 * @example
 * ```typescript
 * // Using AuthSession cookie (handles both formats)
 * const session1 = await getSession({ authSessionCookie: 'AuthSession=abc123' });
 * const session2 = await getSession({ authSessionCookie: 'abc123' });
 *
 * // Using basic auth token
 * const session3 = await getSession({ basicAuthToken: 'dXNlcjpwYXNz' });
 *
 * if (session) {
 *   console.log('User:', session.userCtx.name);
 *   console.log('Roles:', session.userCtx.roles);
 * }
 * ```
 */
export async function getSession(
  authOptions: { authSessionCookie: string } | { basicAuthToken: string },
  config?: CouchDBConfig
): Promise<CouchDBSessionResponse | null> {
  try {
    const { baseUrl } = getCouchDBConfig(config);

    // Build headers based on auth type
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };

    if ('authSessionCookie' in authOptions) {
      // Smart detection: extract cookie value if full "AuthSession=value" format is passed
      let cookieValue = authOptions.authSessionCookie;
      if (cookieValue.startsWith('AuthSession=')) {
        cookieValue = cookieValue.substring('AuthSession='.length);
      }
      headers['Cookie'] = `AuthSession=${cookieValue}`;
    } else if ('basicAuthToken' in authOptions) {
      headers['Authorization'] = `Basic ${authOptions.basicAuthToken}`;
    }

    // console.log('Fetching', `${baseUrl}/_session`, headers)
    const response = await fetch(`${baseUrl}/_session`, {
      method: 'GET',
      headers
    });

    if (response.ok) {
      return await response.json() as CouchDBSessionResponse;
    }

    return null;
  } catch (error) {
    console.warn('Get session failed:', error);
    return null;
  }
}

/**
 * Generate a CouchDB AuthSession cookie value.
 */
export function generateAuthSessionCookie(username, couchSecret, userSalt, timeoutSeconds = 600) {
    // Calculate expiration timestamp
    const expirationTime = Math.floor(Date.now() / 1000) + timeoutSeconds;
    const hexExpiration = expirationTime.toString(16).toUpperCase();

    // Create message to sign
    const message = `${username}:${hexExpiration}`;

    // Create HMAC key (couch secret + user salt)
    const hmacKey = couchSecret + userSalt;

    // Generate HMAC-SHA1 signature
    const hmac = crypto.createHmac('sha1', hmacKey);
    hmac.update(message);
    const signature = hmac.digest();

    // Construct cookie value
    const cookieData = `${username}:${hexExpiration}:${signature.toString('binary')}`;

    // Base64 encode (URL-safe without padding)
    const base64Cookie = Buffer.from(cookieData, 'binary')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

    // For development, skip Secure flag when not using HTTPS
    const isProduction = process.env.NODE_ENV === 'production'
    const secureFlag = isProduction ? '; Secure' : ''

    return `AuthSession=${base64Cookie}; Version=1; Path=/; HttpOnly${secureFlag}`;
}

export function verifyAuthSessionValue ({
                                            value,
                                            serverSecret,
                                            userSaltHex,
                                            hmacAlgos = ['sha256','sha1'], // try your list in order
                                            now = Date.now()
                                        }) {
    if (!value) return { ok: false, reason: 'missing value' }
    const b = value.replace(/-/g, '+').replace(/_/g, '/')
    const raw = Buffer.from(b + '='.repeat((4 - (b.length % 4)) % 4), 'base64')

    // Split "user:hex:macBytes"
    const firstColon = raw.indexOf(':'.charCodeAt(0))
    if (firstColon < 0) return { ok: false, reason: 'bad format' }
    const secondColon = raw.indexOf(':'.charCodeAt(0), firstColon + 1)
    if (secondColon < 0) return { ok: false, reason: 'bad format' }

    const user = raw.slice(0, firstColon).toString('utf8')
    const hex = raw.slice(firstColon + 1, secondColon).toString('utf8')
    const macBytes = raw.slice(secondColon + 1)

    const msg = `${user}:${hex}`
    const key = Buffer.concat([Buffer.from(serverSecret, 'utf8'), Buffer.from(userSaltHex, 'hex')])

    for (const algo of hmacAlgos) {
        const calc = crypto.createHmac(algo, key).update(msg, 'utf8').digest()
        if (crypto.timingSafeEqual(calc, macBytes)) {
            const exp = parseInt(hex, 16)
            const nowSec = Math.floor((now instanceof Date ? now.getTime() : now) / 1000)
            if (Number.isNaN(exp)) return { ok: false, reason: 'bad hex' }
            if (nowSec > exp) return { ok: false, username: user, exp, reason: 'expired' }
            return { ok: true, username: user, exp }
        }
    }
    return { ok: false, reason: 'HMAC mismatch' }
}

/**
 * CouchDB Attachment interfaces
 */
export interface CouchDBAttachment {
  content_type: string;
  digest: string;
  length: number;
  revpos: number;
  stub?: boolean;
}

export interface CouchDBDocumentWithAttachments extends CouchDBDocument {
  _attachments?: {
    [filename: string]: CouchDBAttachment;
  };
}

/**
 * Upload an attachment to a CouchDB document
 *
 * @param databaseName - The name of the CouchDB database
 * @param documentId - The ID of the document to attach to
 * @param attachmentName - The name/filename of the attachment
 * @param data - The attachment data (Buffer, Uint8Array, or base64 string)
 * @param contentType - The MIME type of the attachment
 * @param rev - The current revision of the document
 * @param config - Optional CouchDB configuration
 * @returns Promise that resolves to the attachment upload response
 *
 * @example
 * ```typescript
 * const imageBuffer = fs.readFileSync('logo.png');
 * const result = await putAttachment('mydb', 'client123', 'logo.png', imageBuffer, 'image/png', '1-abc123');
 * ```
 */
export async function putAttachment(
  databaseName: string,
  documentId: string,
  attachmentName: string,
  data: Buffer | Uint8Array | string,
  contentType: string,
  rev: string,
  config?: CouchDBConfig
): Promise<CouchDBResponse> {
  try {
    const { baseUrl } = getCouchDBConfig(config);

    // Convert base64 string to Buffer if needed
    let attachmentData: Buffer | Uint8Array;
    if (typeof data === 'string') {
      // Assume it's base64 encoded
      attachmentData = Buffer.from(data, 'base64');
    } else {
      attachmentData = data;
    }

    const response = await couchDBRequest(
      `${baseUrl}/${databaseName}/${encodeURIComponent(documentId)}/${encodeURIComponent(attachmentName)}?rev=${rev}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
          'Authorization': `Basic ${getCouchDBConfig(config).adminAuth}`
        },
        body: attachmentData
      },
      config
    );

    if (!response.ok) {
      const error: CouchDBError = await response.json();
      throw new Error(`CouchDB attachment upload error: ${error.error} - ${error.reason}`);
    }

    return await response.json() as CouchDBResponse;
  } catch (error) {
    console.error(`Failed to upload attachment: ${attachmentName} to document: ${documentId}`, error);
    throw error;
  }
}

/**
 * Retrieve an attachment from a CouchDB document
 *
 * @param databaseName - The name of the CouchDB database
 * @param documentId - The ID of the document containing the attachment
 * @param attachmentName - The name/filename of the attachment
 * @param config - Optional CouchDB configuration
 * @returns Promise that resolves to the attachment data as Buffer or null if not found
 *
 * @example
 * ```typescript
 * const logoData = await getAttachment('mydb', 'client123', 'logo.png');
 * if (logoData) {
 *   // Use the attachment data
 *   response.setHeader('Content-Type', 'image/png');
 *   return logoData;
 * }
 * ```
 */
export async function getAttachment(
  databaseName: string,
  documentId: string,
  attachmentName: string,
  config?: CouchDBConfig
): Promise<{ data: Buffer; contentType: string } | null> {
  try {
    const { baseUrl } = getCouchDBConfig(config);

    const response = await couchDBRequest(
      `${baseUrl}/${databaseName}/${encodeURIComponent(documentId)}/${encodeURIComponent(attachmentName)}`,
      {
        method: 'GET'
      },
      config
    );

    if (response.ok) {
      const data = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      return { data, contentType };
    }

    return null;
  } catch (error) {
    console.warn(`Failed to get attachment: ${attachmentName} from document: ${documentId}`, error);
    return null;
  }
}

/**
 * Delete an attachment from a CouchDB document
 *
 * @param databaseName - The name of the CouchDB database
 * @param documentId - The ID of the document containing the attachment
 * @param attachmentName - The name/filename of the attachment
 * @param rev - The current revision of the document
 * @param config - Optional CouchDB configuration
 * @returns Promise that resolves to the deletion response
 *
 * @example
 * ```typescript
 * const result = await deleteAttachment('mydb', 'client123', 'logo.png', '2-def456');
 * ```
 */
export async function deleteAttachment(
  databaseName: string,
  documentId: string,
  attachmentName: string,
  rev: string,
  config?: CouchDBConfig
): Promise<CouchDBResponse> {
  try {
    const { baseUrl } = getCouchDBConfig(config);

    const response = await couchDBRequest(
      `${baseUrl}/${databaseName}/${encodeURIComponent(documentId)}/${encodeURIComponent(attachmentName)}?rev=${rev}`,
      {
        method: 'DELETE'
      },
      config
    );

    if (!response.ok) {
      const error: CouchDBError = await response.json();
      throw new Error(`CouchDB attachment deletion error: ${error.error} - ${error.reason}`);
    }

    return await response.json() as CouchDBResponse;
  } catch (error) {
    console.error(`Failed to delete attachment: ${attachmentName} from document: ${documentId}`, error);
    throw error;
  }
}

/**
 * Logout user by making DELETE request to CouchDB's _session endpoint
 * This clears the AuthSession cookie and effectively logs out the user
 *
 * @param authOptions - Either { authSessionCookie: string } or { basicAuthToken: string }
 * @param config - Optional CouchDB configuration
 * @returns Promise that resolves to logout response or null on failure
 *
 * @example
 * ```typescript
 * // Using AuthSession cookie
 * const result = await logout({ authSessionCookie: 'abc123' });
 *
 * // Using basic auth token
 * const result = await logout({ basicAuthToken: 'dXNlcjpwYXNz' });
 *
 * if (result?.ok) {
 *   console.log('User logged out successfully');
 * } else {
 *   console.log('Logout failed');
 * }
 * ```
 */
export async function logout(
  authOptions: { authSessionCookie: string } | { basicAuthToken: string },
  config?: CouchDBConfig
): Promise<{ ok: boolean; setCookie?: string } | null> {
  try {
    const { baseUrl } = getCouchDBConfig(config);

    // Build headers based on auth type
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };

    if ('authSessionCookie' in authOptions) {
      // Smart detection: extract cookie value if full "AuthSession=value" format is passed
      let cookieValue = authOptions.authSessionCookie;
      if (cookieValue.startsWith('AuthSession=')) {
        cookieValue = cookieValue.substring('AuthSession='.length);
      }
      headers['Cookie'] = `AuthSession=${cookieValue}`;
    } else if ('basicAuthToken' in authOptions) {
      headers['Authorization'] = `Basic ${authOptions.basicAuthToken}`;
    }

    const response = await fetch(`${baseUrl}/_session`, {
      method: 'DELETE',
      headers
    });

    if (response.ok) {
      const result = await response.json();

      // Extract Set-Cookie header that clears the AuthSession cookie
      const setCookieHeader = response.headers.get('set-cookie');

      return {
        ok: result.ok || true,
        setCookie: setCookieHeader || undefined
      };
    }

    return null;
  } catch (error) {
    console.warn('Logout failed:', error);
    return null;
  }
}
