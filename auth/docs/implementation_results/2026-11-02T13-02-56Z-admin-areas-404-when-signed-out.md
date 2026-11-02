# Admin areas answer 404 when signed out

## Request

`/admin`, `/builder` and `/k` should return 404 to unauthenticated visitors instead of
redirecting to `/login` (for `apps/paleologu-prosti`, in the base layers).

## Where the redirect came from

Every protected page under those prefixes uses the auth layer's `auth` route middleware:
this app's `/admin` and `/admin/signups`, content's `/admin/pages` and the builder page
(`/builder`, alias `/k`, same page), and the analytics dashboards. Without a session, `auth`
stored the target in a `redirectTo` cookie and redirected to `authLoginPath`. `/admin/datasync`
uses `admin-auth`, which already answered 404. The analytics share page
(`/admin/analytics/share/:token`) has no middleware and stays public.

## Change (auth layer only)

- `app/utils/hidden-paths.ts`: `DEFAULT_AUTH_HIDDEN_PATHS = "/admin,/builder,/k"`,
  `parseAuthHiddenPaths()` and `isAuthHiddenPath()`. Matching is by whole segments (`/admin` and
  `/admin/x`, not `/administrator` or `/admin-not-here`), ignoring case, percent-encoding,
  repeated and trailing slashes.
- `app/middleware/auth.ts`: signed out and under a hidden prefix → `createError({ statusCode: 404,
  statusMessage: "Page not found" })`; no redirect, no `redirectTo` cookie. Other protected pages
  redirect as before. The login page itself is never hidden.
- `nuxt.config.ts`: `public.authHiddenPaths: "/admin,/builder,/k"`. It's a string, not an array:
  Nuxt concatenates arrays across layers, so an app could never shrink an array default.
  `NUXT_PUBLIC_AUTH_HIDDEN_PATHS` overrides it; `''` restores the redirect everywhere.
- Apps render the 404 with their own error page; in `paleologu-prosti` that is the full-screen
  NotFound page.

Scope kept to signed-out visitors: a signed-in user without the role still gets `role-auth`'s 403.
A path the matcher misses would fall back to the old behaviour (login redirect), never to access.

## Verification

- `auth/app/middleware/auth.spec.ts` (22 tests, the real middleware with Nuxt helpers stubbed):
  404 without redirect or cookie for `/admin`, `/admin/`, `/admin/signups`,
  `/admin/analytics/events`, `/builder`, `/builder/despre`, `/k`, `/k/test/head`, `/ADMIN`,
  `//admin`, `/%61dmin`; redirect as before for `/members`, `/account/orders`, `/administrator`,
  `/kids`, `/builders-guild`; signed in passes; login page never hidden; custom prefixes and `''`;
  default when unset; parser and segment matching.
- `bunx vitest run --config vitest.config.ts auth` → 59 tests pass (the two Bun-only files in
  `auth/app/utils` can't load under vitest, as before).
- Live, `apps/paleologu-prosti` after a dev-server restart (the middleware is registered by a
  plugin, and Vite's hot reload didn't refresh it for server rendering):
  - no session: `/admin`, `/admin/`, `/admin/signups`, `/admin/pages`, `/admin/analytics`,
    `/admin/analytics/events`, `/admin/datasync`, `/builder`, `/builder/test/head`, `/k`,
    `/k/test/head` → 404 with the NotFound page, no `Location`, no `Set-Cookie`; `/login` and `/`
    → 200.
  - signed in (browser): `/admin` dashboard, `/k` builder with its preview, `/admin/signups` open
    as before.

## Effect on other apps

All apps extending the auth layer get this by default: signed-out visits to their `/admin`,
`/builder` or `/k` pages now show 404 instead of the login page. Editors must open `/login` (or the
app's `authLoginPath`) directly. Apps that want the redirect back set `authHiddenPaths: ''`.
