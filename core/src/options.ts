import {
  CoreConfigurationError,
  isLocalPath,
  validateSettings,
} from './config-schema'
import type {
  CouchDBModuleOptions,
  ResolvedOptions,
  ResolvedCouchDBSettings,
  PublicCouchDBSettings,
  BuildFeatures,
  AdminColorScheme,
} from './shared/types'
export type { CouchDBModuleOptions } from './shared/types'
export function safeRedirect(value: unknown, fallback = '/') {
  return isLocalPath(value) ? value : fallback
}
export function resolveOptions(
  input: CouchDBModuleOptions = {},
): ResolvedOptions {
  for (const [key, value] of Object.entries({
    auth: input.auth,
    admin: input.admin,
    config: input.config,
    defaults: input.defaults,
    'defaults.auth': input.defaults?.auth,
    'defaults.admin': input.defaults?.admin,
  })) {
    if (
      value !== undefined &&
      (!value || typeof value !== 'object' || Array.isArray(value))
    )
      throw new CoreConfigurationError(`${key} must be an object`)
  }
  const a = input.auth ?? {},
    d = input.admin ?? {}
  for (const [key, value] of Object.entries({
    'auth.enabled': a.enabled,
    'auth.password': a.password,
    'auth.email': a.email,
    'auth.nostr': a.nostr,
    'auth.ui': a.ui,
    'auth.liveUsers': a.liveUsers,
    'auth.proofOfWork': a.proofOfWork,
    'admin.enabled': d.enabled,
    'admin.dataSync': d.dataSync,
    'config.enabled': input.config?.enabled,
    'config.required': input.config?.required,
  })) {
    if (value !== undefined && typeof value !== 'boolean')
      throw new CoreConfigurationError(`${key} must be a boolean`)
  }
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
  const resolved: ResolvedOptions = {
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
        brandName: 'CouchFusion',
        siteName: '',
        footerText: '',
        ...input.defaults?.admin,
        theme: colorScheme(input.defaults?.admin?.theme ?? 'system'),
        sections: d.sections ?? [],
      },
    },
  }
  validateSettings(
    {
      appSlug,
      features,
      auth: resolved.defaults.auth,
      admin: resolved.defaults.admin,
      secrets: { cookieSecret: '', senderNsec: '' },
    },
    false,
  )
  return resolved
}
/** Earlier skins ('ledger', 'classic') predate the light/dark pair and now follow the system setting. */
function colorScheme(value: unknown) {
  return (value === 'ledger' || value === 'classic' ? 'system' : value) as AdminColorScheme
}
function boolean(value: string, key: string) {
  if (value !== 'true' && value !== 'false')
    throw new CoreConfigurationError(`${key} must be a boolean string`)
  return value === 'true'
}
function integer(value: string, key: string, min: number, max: number) {
  if (!/^\d+$/.test(value) || Number(value) < min || Number(value) > max)
    throw new CoreConfigurationError(`${key} must be an integer ${min}..${max}`)
  return Number(value)
}
export function resolveSettings(
  options: ResolvedOptions,
  remote: Record<string, string> = {},
): ResolvedCouchDBSettings {
  const auth = { ...options.defaults.auth },
    admin = { ...options.defaults.admin, theme: colorScheme(options.defaults.admin.theme) },
    features = { ...options.features }
  for (const key of [
    'auth_user_prefix',
    'auth_token_database',
    'auth_challenge_database',
    'auth_heading',
    'admin_brand_name',
    'admin_site_name',
    'admin_footer_text',
    'auth_redirect_path',
    'auth_token_ttl_seconds',
    'auth_session_max_age_seconds',
    'auth_pow_bits',
    'auth_pow_ttl_seconds',
    'auth_password_enabled',
    'auth_email_enabled',
    'auth_nostr_enabled',
    'auth_live_users_enabled',
    'admin_enabled',
    'admin_datasync_enabled',
    'admin_roles',
    'admin_theme',
    'nostr_relays',
    'nostr_dm_mode',
    'auth_cookie_secret',
    'nostr_sender_nsec',
  ])
    if (remote[key] !== undefined && typeof remote[key] !== 'string')
      throw new CoreConfigurationError(`${key} must be a string`)
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
  if (remote.auth_redirect_path !== undefined)
    auth.redirectPath = remote.auth_redirect_path
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
  const hasLoginMethod = features.password || features.email || features.nostr
  features.ui = features.ui && hasLoginMethod
  features.proofOfWork =
    features.proofOfWork && (features.email || features.nostr)
  if (remote.admin_roles !== undefined)
    admin.roles = remote.admin_roles
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean)
  if (remote.admin_theme !== undefined)
    admin.theme = colorScheme(remote.admin_theme)
  if (remote.nostr_relays !== undefined)
    auth.nostrRelays = remote.nostr_relays
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean)
  if (remote.nostr_dm_mode !== undefined)
    auth.nostrDmMode = remote.nostr_dm_mode as typeof auth.nostrDmMode
  const settings: ResolvedCouchDBSettings = {
    appSlug: options.appSlug,
    features,
    auth,
    admin,
    secrets: {
      cookieSecret: remote.auth_cookie_secret ?? '',
      senderNsec: remote.nostr_sender_nsec ?? '',
    },
  }
  validateSettings(settings)
  return settings
}
export function publicSettings(
  settings: ResolvedCouchDBSettings,
): PublicCouchDBSettings {
  return structuredClone({
    features: { ...settings.features },
    auth: {
      loginPath: settings.auth.loginPath,
      redirectPath: settings.auth.redirectPath,
      heading: settings.auth.heading,
    },
    admin: {
      roles: settings.admin.roles,
      theme: settings.admin.theme,
      brandName: settings.admin.brandName,
      siteName: settings.admin.siteName,
      footerText: settings.admin.footerText,
      sections: settings.admin.sections,
    },
  })
}
