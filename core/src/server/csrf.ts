import { createHmac } from 'node:crypto'
/** Same deployment credential gives every worker the same key; session changes invalidate tokens. */
export function createCsrfToken(session: string, bootstrapSecret: string) {
  return createHmac('sha256', bootstrapSecret)
    .update('core:csrf:v1\0' + session)
    .digest('base64url')
}
