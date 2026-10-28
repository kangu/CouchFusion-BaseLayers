import type { ResolvedCouchDBSettings } from './shared/types'

/** Messages name configuration fields, never their potentially secret values. */
export class CoreConfigurationError extends Error {
  constructor(message: string) {
    super(`[couchdb] ${message}`)
    this.name = 'CoreConfigurationError'
  }
}
function invalid(key: string, expected: string): never {
  throw new CoreConfigurationError(`${key} must be ${expected}`)
}
function string(
  value: unknown,
  key: string,
  required = false,
): asserts value is string {
  if (typeof value !== 'string' || (required && !value.trim()))
    invalid(key, required ? 'a nonempty string' : 'a string')
}
function integer(value: unknown, key: string, min: number, max: number) {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  )
    invalid(key, `an integer ${min}..${max}`)
}
function roles(value: unknown, key: string) {
  if (
    !Array.isArray(value) ||
    value.some(
      (role) =>
        typeof role !== 'string' || !role.trim() || role !== role.trim(),
    )
  )
    invalid(
      key,
      'an array of nonempty role names without surrounding whitespace',
    )
}
export function isLocalPath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !/[\\\u0000-\u001f]/.test(value)
  )
}
function object(
  value: unknown,
  key: string,
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    invalid(key, 'an object')
}
function sections(value: unknown) {
  if (!Array.isArray(value)) invalid('admin.sections', 'an array')
  for (const [index, section] of value.entries()) {
    const key = `admin.sections[${index}]`
    object(section, key)
    string(section.id, key + '.id', true)
    string(section.title, key + '.title', true)
    if (section.requiresRoles !== undefined)
      roles(section.requiresRoles, key + '.requiresRoles')
    if (!Array.isArray(section.items)) invalid(key + '.items', 'an array')
    for (const [itemIndex, item] of section.items.entries()) {
      const itemKey = `${key}.items[${itemIndex}]`
      object(item, itemKey)
      string(item.label, itemKey + '.label', true)
      if (!isLocalPath(item.route))
        invalid(itemKey + '.route', 'a local absolute path')
      if (item.icon !== undefined) string(item.icon, itemKey + '.icon')
      if (item.requiresRoles !== undefined)
        roles(item.requiresRoles, itemKey + '.requiresRoles')
      if (
        item.activeRoutes !== undefined &&
        (!Array.isArray(item.activeRoutes) ||
          !item.activeRoutes.every(isLocalPath))
      )
        invalid(itemKey + '.activeRoutes', 'an array of local absolute paths')
    }
  }
}
function database(value: unknown, key: string) {
  string(value, key)
  if (value !== '' && !/^[a-z][a-z0-9_$()+/-]*$/.test(value))
    invalid(key, 'a non-system CouchDB database name')
}
/** The same validation applies after source precedence and to setup defaults. */
export function validateSettings(
  settings: ResolvedCouchDBSettings,
  requireFeatureConfiguration = true,
): void {
  const { features, auth, admin, secrets } = settings
  for (const [key, value] of Object.entries(features))
    if (typeof value !== 'boolean') invalid(`features.${key}`, 'a boolean')
  string(settings.appSlug, 'appSlug')
  string(auth.userPrefix, 'auth_user_prefix')
  string(auth.heading, 'auth_heading')
  if (!isLocalPath(auth.loginPath))
    invalid('auth.loginPath', 'a local absolute path')
  if (!isLocalPath(auth.redirectPath))
    invalid('auth_redirect_path', 'a local absolute path')
  integer(auth.tokenTtlSeconds, 'auth_token_ttl_seconds', 60, 3600)
  integer(auth.sessionMaxAgeSeconds, 'auth_session_max_age_seconds', 60, 86400)
  integer(auth.proofOfWorkBits, 'auth_pow_bits', 1, 24)
  integer(auth.proofOfWorkTtlSeconds, 'auth_pow_ttl_seconds', 30, 3600)
  database(auth.tokenDatabase, 'auth_token_database')
  database(auth.challengeDatabase, 'auth_challenge_database')
  if (!['nip17', 'nip04', 'dual'].includes(auth.nostrDmMode))
    invalid('nostr_dm_mode', 'nip17, nip04 or dual')
  if (
    !Array.isArray(auth.nostrRelays) ||
    auth.nostrRelays.some((relay) => {
      if (typeof relay !== 'string') return true
      try {
        const url = new URL(relay)
        return (
          url.protocol !== 'wss:' ||
          !url.hostname ||
          Boolean(url.username || url.password)
        )
      } catch {
        return true
      }
    })
  )
    invalid('nostr_relays', 'an array of valid wss URLs without credentials')
  roles(admin.roles, 'admin_roles')
  if (features.admin && !admin.roles.length)
    invalid('admin_roles', 'nonempty when admin is enabled')
  if (!['system', 'light', 'dark'].includes(admin.theme))
    invalid('admin_theme', 'system, light or dark')
  string(admin.brandName, 'admin_brand_name')
  string(admin.siteName, 'admin_site_name')
  string(admin.footerText, 'admin_footer_text')
  sections(admin.sections)
  string(secrets.cookieSecret, 'auth_cookie_secret')
  string(secrets.senderNsec, 'nostr_sender_nsec')
  if (requireFeatureConfiguration) {
    if (features.email && !auth.tokenDatabase)
      invalid('auth_token_database', 'configured when email login is enabled')
    if ((features.nostr || features.proofOfWork) && !auth.challengeDatabase)
      invalid(
        'auth_challenge_database',
        'configured when Nostr or proof of work is enabled',
      )
    if ((features.email || features.nostr) && !secrets.cookieSecret.trim())
      invalid(
        'auth_cookie_secret',
        'configured when passwordless login is enabled',
      )
  }
}
/** Clone first so freezing runtime policy cannot freeze the caller's configuration. */
export function immutableSettingsSnapshot<T>(value: T): T {
  const copy = structuredClone(value)
  const seen = new WeakSet<object>()
  const freeze = (item: unknown): void => {
    if (item === null || typeof item !== 'object' || seen.has(item)) return
    seen.add(item)
    for (const child of Object.values(item)) freeze(child)
    Object.freeze(item)
  }
  freeze(copy)
  return copy
}
