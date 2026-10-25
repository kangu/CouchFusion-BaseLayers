import type {
  CouchDBModuleOptions,
  ResolvedOptions,
  ResolvedCouchDBSettings,
  PublicCouchDBSettings,
  BuildFeatures,
} from './shared/types'
export type { CouchDBModuleOptions } from './shared/types'
export function safeRedirect(value: unknown, fallback = '/') {
  return typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !/[\\\u0000-\u001f]/.test(value)
    ? value
    : fallback
}
export function resolveOptions(
  input: CouchDBModuleOptions = {},
): ResolvedOptions {
  const a = input.auth ?? {},
    d = input.admin ?? {}
  const features: BuildFeatures = {
    auth: a.enabled ?? false,
    password: a.password ?? false,
    email: a.email ?? false,
    nostr: a.nostr ?? false,
    ui: a.ui ?? false,
    liveUsers: a.liveUsers ?? false,
    proofOfWork: a.proofOfWork ?? false,
    admin: d.enabled ?? false,
    dataSync: d.dataSync ?? false,
  }
  if (
    !features.auth &&
    Object.entries(features).some(([k, v]) => k !== 'auth' && v)
  )
    throw new Error(
      '[couchdb] Enabled auth/admin features require auth.enabled: true',
    )
  if (features.dataSync && !features.admin)
    throw new Error('[couchdb] Data Sync requires admin.enabled: true')
  if (features.ui && !features.password && !features.email && !features.nostr)
    throw new Error('[couchdb] Login UI requires an enabled login method')
  if (features.proofOfWork && !features.email && !features.nostr)
    throw new Error('[couchdb] Proof of work requires email or Nostr')
  const appSlug = (input.appSlug ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (input.config?.enabled && !appSlug)
    throw new Error('[couchdb] config.enabled requires an explicit appSlug')
  const loginPath = a.loginPath ?? '/login'
  if (
    safeRedirect(loginPath, '') !== loginPath ||
    loginPath.includes('?') ||
    loginPath.startsWith('/admin') ||
    loginPath.startsWith('/api/')
  )
    throw new Error('[couchdb] Invalid auth.loginPath')
  return {
    appSlug,
    config: {
      enabled: input.config?.enabled ?? false,
      required: input.config?.required ?? true,
    },
    features,
    emailDeliveryHandler: a.emailDeliveryHandler,
    defaults: {
      auth: {
        redirectPath: '/',
        heading: 'Sign in',
        userPrefix: '',
        tokenDatabase: '',
        challengeDatabase: '',
        tokenTtlSeconds: 600,
        sessionMaxAgeSeconds: 600,
        proofOfWorkBits: 18,
        proofOfWorkTtlSeconds: 600,
        nostrRelays: [],
        nostrDmMode: 'nip17',
        ...input.defaults?.auth,
        loginPath,
      },
      admin: {
        roles: ['admin'],
        theme: 'ledger',
        brandName: 'CouchFusion',
        siteName: '',
        footerText: '',
        ...input.defaults?.admin,
        sections: d.sections ?? [],
      },
    },
  }
}
function boolean(value: string, key: string) {
  if (value !== 'true' && value !== 'false')
    throw new Error(`[couchdb] ${key} must be a boolean string`)
  return value === 'true'
}
function integer(value: string, key: string, min: number, max: number) {
  if (!/^\d+$/.test(value) || Number(value) < min || Number(value) > max)
    throw new Error(`[couchdb] Invalid ${key}: expected integer ${min}..${max}`)
  return Number(value)
}
export function resolveSettings(
  options: ResolvedOptions,
  remote: Record<string, string> = {},
): ResolvedCouchDBSettings {
  const auth = { ...options.defaults.auth },
    admin = { ...options.defaults.admin },
    features = { ...options.features }
  const strings: Record<string, [object, string]> = {
    auth_user_prefix: [auth, 'userPrefix'],
    auth_token_database: [auth, 'tokenDatabase'],
    auth_challenge_database: [auth, 'challengeDatabase'],
    auth_heading: [auth, 'heading'],
    admin_brand_name: [admin, 'brandName'],
    admin_site_name: [admin, 'siteName'],
    admin_footer_text: [admin, 'footerText'],
  }
  for (const [key, [target, field]] of Object.entries(strings))
    if (remote[key] !== undefined) (target as any)[field] = remote[key]
  if (remote.auth_redirect_path !== undefined) {
    if (safeRedirect(remote.auth_redirect_path, '') === '')
      throw new Error('[couchdb] Invalid auth_redirect_path')
    auth.redirectPath = remote.auth_redirect_path
  }
  const numbers: Record<string, [keyof typeof auth, number, number]> = {
    auth_token_ttl_seconds: ['tokenTtlSeconds', 60, 3600],
    auth_session_max_age_seconds: ['sessionMaxAgeSeconds', 60, 86400],
    auth_pow_bits: ['proofOfWorkBits', 1, 24],
    auth_pow_ttl_seconds: ['proofOfWorkTtlSeconds', 30, 3600],
  }
  for (const [key, [field, min, max]] of Object.entries(numbers))
    if (remote[key] !== undefined)
      (auth as any)[field] = integer(remote[key], key, min, max)
  const flags: Record<string, keyof BuildFeatures> = {
    auth_password_enabled: 'password',
    auth_email_enabled: 'email',
    auth_nostr_enabled: 'nostr',
    auth_live_users_enabled: 'liveUsers',
    admin_enabled: 'admin',
    admin_datasync_enabled: 'dataSync',
  }
  for (const [key, field] of Object.entries(flags))
    if (remote[key] !== undefined)
      features[field] = boolean(remote[key], key) && features[field]
  features.dataSync = features.admin && features.dataSync
  if (remote.admin_roles !== undefined)
    admin.roles = remote.admin_roles
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean)
  if (features.admin && !admin.roles.length)
    throw new Error('[couchdb] admin roles cannot be empty')
  if (remote.admin_theme !== undefined) {
    if (!['ledger', 'classic'].includes(remote.admin_theme))
      throw new Error('[couchdb] Invalid admin_theme')
    admin.theme = remote.admin_theme as 'ledger' | 'classic'
  }
  if (remote.nostr_relays !== undefined)
    auth.nostrRelays = remote.nostr_relays
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean)
  if (auth.nostrRelays.some((r) => !r.startsWith('wss://')))
    throw new Error('[couchdb] nostr_relays must use wss')
  if (remote.nostr_dm_mode !== undefined) {
    if (!['nip17', 'nip04', 'dual'].includes(remote.nostr_dm_mode))
      throw new Error('[couchdb] Invalid nostr_dm_mode')
    auth.nostrDmMode = remote.nostr_dm_mode as typeof auth.nostrDmMode
  }
  if (safeRedirect(auth.redirectPath, '') === '')
    throw new Error('[couchdb] Invalid redirectPath')
  return {
    appSlug: options.appSlug,
    features,
    auth,
    admin,
    secrets: {
      cookieSecret: remote.auth_cookie_secret ?? '',
      senderNsec: remote.nostr_sender_nsec ?? '',
    },
  }
}
export function publicSettings(
  settings: ResolvedCouchDBSettings,
): PublicCouchDBSettings {
  return {
    features: { ...settings.features },
    auth: {
      loginPath: settings.auth.loginPath,
      redirectPath: settings.auth.redirectPath,
      heading: settings.auth.heading,
    },
    admin: { ...settings.admin },
  }
}
