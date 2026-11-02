export function dataSyncHeaders(csrfToken: string, existing?: HeadersInit) {
  const headers = new Headers(existing)
  headers.set('x-couchdb-csrf', csrfToken)
  return headers
}
