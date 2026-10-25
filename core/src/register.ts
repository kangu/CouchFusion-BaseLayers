import type { BuildFeatures } from './shared/types'
export function featureManifest(f: BuildFeatures) {
  const routes: string[] = [],
    pages: string[] = [],
    middleware: string[] = [],
    plugins: string[] = []
  if (f.auth) {
    routes.push('/api/couchdb/session', '/api/couchdb/settings')
    middleware.push('couchdb-session')
  }
  if (f.password) routes.push('/api/couchdb/login/password')
  if (f.email)
    routes.push(
      '/api/couchdb/login/email/request',
      '/api/couchdb/login/email/verify',
    )
  if (f.nostr)
    routes.push(
      '/api/couchdb/login/nostr/challenge',
      '/api/couchdb/login/nostr/verify',
    )
  if (f.proofOfWork) routes.push('/api/couchdb/proof-of-work/challenge')
  if (f.ui) pages.push('/login')
  if (f.admin) {
    pages.push('/admin')
    routes.push('/api/couchdb/admin/users')
  }
  if (f.dataSync) {
    pages.push('/admin/datasync')
    routes.push('/api/couchdb/admin/datasync/**')
  }
  if (f.liveUsers) {
    routes.push('/api/couchdb/live-users')
    plugins.push('couchdb-live-users')
  }
  return { routes, pages, middleware, plugins }
}
