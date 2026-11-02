export interface CouchDBUser {
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
export interface PublicSettings {
  features: {
    auth: boolean
    password: boolean
    email: boolean
    nostr: boolean
    ui: boolean
    admin: boolean
    dataSync: boolean
    liveUsers: boolean
    proofOfWork: boolean
  }
  auth: { loginPath: string; redirectPath: string; heading: string }
  admin: {
    roles: string[]
    theme: 'system' | 'light' | 'dark'
    brandName: string
    siteName: string
    footerText: string
    sections: AdminSection[]
  }
}
export interface SessionResponse {
  user: CouchDBUser | null
  settings: PublicSettings
  csrfToken: string
}
