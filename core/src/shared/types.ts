export interface AuthUser {
  name: string
  roles: string[]
}
export interface AdminItem {
  label: string
  route: string
  icon?: string
  requiresRoles?: string[]
  activeRoutes?: string[]
}
export interface AdminSection {
  id: string
  title: string
  requiresRoles?: string[]
  items: AdminItem[]
}
export interface BuildFeatures {
  auth: boolean
  password: boolean
  email: boolean
  nostr: boolean
  ui: boolean
  liveUsers: boolean
  proofOfWork: boolean
  admin: boolean
  dataSync: boolean
}
export interface CouchDBModuleOptions {
  appSlug?: string
  config?: { enabled?: boolean; required?: boolean }
  provisioning?: 'off' | 'explicit'
  auth?: {
    enabled?: boolean
    password?: boolean
    email?: boolean
    nostr?: boolean
    ui?: boolean
    liveUsers?: boolean
    proofOfWork?: boolean
    loginPath?: string
    emailDeliveryHandler?: string
  }
  admin?: { enabled?: boolean; dataSync?: boolean; sections?: AdminSection[] }
  defaults?: { auth?: Partial<AuthSettings>; admin?: Partial<AdminSettings> }
}
export interface AuthSettings {
  loginPath: string
  redirectPath: string
  heading: string
  userPrefix: string
  tokenDatabase: string
  challengeDatabase: string
  tokenTtlSeconds: number
  sessionMaxAgeSeconds: number
  proofOfWorkBits: number
  proofOfWorkTtlSeconds: number
  nostrRelays: string[]
  nostrDmMode: 'nip17' | 'nip04' | 'dual'
}
export type AdminColorScheme = 'system' | 'light' | 'dark'
export interface AdminSettings {
  roles: string[]
  /** Default colour scheme of the admin and login UI; people can override it with the toggle. */
  theme: AdminColorScheme
  brandName: string
  siteName: string
  footerText: string
  sections: AdminSection[]
}
export interface ResolvedOptions {
  appSlug: string
  config: { enabled: boolean; required: boolean }
  features: BuildFeatures
  defaults: { auth: AuthSettings; admin: AdminSettings }
  emailDeliveryHandler?: string
}
export interface ResolvedCouchDBSettings {
  appSlug: string
  features: BuildFeatures
  auth: AuthSettings
  admin: AdminSettings
  secrets: { cookieSecret: string; senderNsec: string }
}
export interface PublicCouchDBSettings {
  features: BuildFeatures
  auth: Pick<AuthSettings, 'loginPath' | 'redirectPath' | 'heading'>
  admin: AdminSettings
}
