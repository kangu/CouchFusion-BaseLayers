# Initial Prompt
Investigate how to include this as a server route in the analytics plugin so the caddy configuration is not needed anymore. The https://cloud.umami.is value should be exposed as a runtime property -- subsequent request asked to move admin-session helper into auth layer.

# Implementation Summary
Centralised the admin session assertion helper inside the auth layer so all apps can reuse the same logic when guarding server routes.

# Documentation Overview
- Added `server/utils/assert-admin-session.ts` to the auth layer, replicating the CouchDB AuthSession validation previously duplicated in each app.
- Removed the app-local `server/utils/admin-session.ts` from `apps/bitvocation` and switched email template API routes to import from `#auth/server/utils/assert-admin-session`.

# Implementation Examples
- `layers/auth/server/utils/assert-admin-session.ts`
  ```ts
  export const assertAdminSession = async (event: H3Event) => {
    const cookie = getHeader(event, 'cookie')
    const token = extractAuthSessionCookie(cookie)
    const session = await getSession({ authSessionCookie: token })
    if (!session?.userCtx?.roles?.includes('admin')) {
      throw createError({ statusCode: 404, statusMessage: 'Not found' })
    }
    return { session, sessionToken: token }
  }
  ```
