# Layer: auth

Runtime: Nuxt 4.x, Vue 3.5.x.

Authentication proxy layer for CouchDB `_session`-based apps. It provides the default login page, session store, auth/admin/role middleware, CouchDB user/session endpoints, Nostr login, proof-of-work challenge support, and a websocket user-changes feed. It extends `layers/database`.

Before changing behavior, inspect the consuming app's `nuxt.config.ts` and app-level `agents.md`. App instructions can override validation commands, login UI expectations, or role names.

## Critical Paths

- `nuxt.config.ts` — `#auth` alias, `@pinia/nuxt`, middleware/store auto-imports, websocket enablement, route CORS, runtime config, and startup validation.
- `app/stores/auth.ts` — Pinia store exported as `useAuthStore`.
- `app/middleware/` — `auth`, `admin_auth`, `role_auth`, and global session hydration.
- `app/pages/login.vue` — default login UI; consumers should shadow it with their own page when they need custom UI.
- `server/api/login*`, `server/api/logout.delete.ts`, `server/api/users.get.ts` — CouchDB-backed login/logout/user API surface.
- `server/api/auth/nostr/*` — Nostr challenge/verify flow.
- `server/api/proof-of-work/challenge.post.ts` and `server/utils/proof-of-work*` — login proof-of-work flow.
- `server/routes/live-events.ts` and `server/plugins/usersChanges.global.ts` — websocket user-change feed.
- `server/utils/authenticated-user.ts`, `server/utils/assert-admin-session.ts`, `server/utils/couchSession.ts` — shared server auth helpers.
- `utils/design-documents.ts` — CouchDB `_users` design documents.
- `docs/` — search by topic/date before changing older login, websocket, Nostr, or CouchDB behavior.

## Public Surfaces

- Alias: `#auth`.
- Store: `useAuthStore()` with user/session state and role helpers.
- Route middleware names: `auth`, `admin_auth`, `role_auth`; global middleware: `userSession`.
- Default page: `/login`.
- API groups: `/api/login*`, `/api/logout`, `/api/users`, `/api/auth/nostr/*`, `/api/proof-of-work/challenge`.
- Websocket route: `/api/routes/live-events`.
- Public runtime config: `authLoginPath`, `authDefaultRedirectPath`, `authLoginHeading`.
- Required consumer config/env: `runtimeConfig.dbLoginPrefix` and `COUCHDB_ADMIN_AUTH`. Nothing else: there is no cookie-secret setting. Session cookies, Nostr challenges and proof-of-work challenges all use CouchDB's own `chttpd_auth/secret`, read with the admin credentials.

## Conventions

- User documents live in CouchDB `_users` and are prefixed by `runtimeConfig.dbLoginPrefix`.
- Never persist real user passwords; generated CouchDB passwords are used only to obtain the proxied `AuthSession` cookie.
- Middleware filenames map to route middleware names. Do not rename `admin_auth.ts` or `role_auth.ts` without updating consumers.
- Nostr config is read from CouchDB `_config` section `cf_env_[slug]` when configured, with runtime env as fallback.
- Server utils are for Nitro/server contexts. Do not import them into app/client code.
- The auth design document is pushed by `server/plugins/init.ts`; do not duplicate `_users` view definitions elsewhere.
- Keep cookie handling compatible with CouchDB `_session`; session cookies must remain stable across SSR/API requests.

## Commands

- Auth utility tests: `bunx vitest --config layers/vitest.config.ts layers/auth/app/utils/login-redirect.test.ts layers/auth/app/utils/login-heading.test.ts --run` after adding the needed `#auth` alias if a new test imports it.
- Consumer validation: use the target app's allowed commands; do not assume lint/build are permitted.
- Smoke test in a running consumer app: `GET /api/login`, `POST /api/login`, and `DELETE /api/logout`.
- For admin-page testing, authenticate through the password API when the visible login page is email/Nostr-first.

## Gotchas

- Nuxt startup validates `dbLoginPrefix` and `COUCHDB_ADMIN_AUTH`. `COUCHDB_COOKIE_SECRET` / `NUXT_COUCHDB_COOKIE_SECRET` are no longer read anywhere (removed 2026-11-02); apps can drop them.
- `COUCHDB_ADMIN_AUTH` must be base64 of `username:password`.
- `userSession.global.ts` runs on every server-rendered navigation; keep it light.
- `/api/routes/live-events` requires websocket-capable reverse proxies.
- Default `nostrDmMode` is `nip17`, not `nip04`; changing it affects verification/DM behavior.
- Proof-of-work defaults include `enabled: "true"`, `difficultyBits: 18`, and `ttlSeconds: 600`; coerce string booleans before checking.
- Consumers customize login UI by shadowing `/login`, not by editing this layer's default login page.
- Cookie secret rotation invalidates existing sessions across all instances.
- Every login issues its session through `server/utils/session-cookie.ts`: stamped one year ahead with `Max-Age` (override per app with `cf_env_<slug>.auth_session_max_age_seconds` or `NUXT_AUTH_SESSION_MAX_AGE_SECONDS`). The secret is always CouchDB's `chttpd_auth/secret` (legacy `couch_httpd_auth/secret`), read by `resolveCookieSecret` and cached for five minutes; a failed read keeps the last good value. The init plugin reads it at startup. The cookie salt comes from `[admins]` first (CouchDB checks server admins before `_users`), and each cookie is checked with `GET /_session` before it is sent. Do not pass CouchDB's own `_session` cookie through: it expires after CouchDB's 600 s timeout.
- `assert-admin-session` throws a 403; consumers should render/handle forbidden states explicitly.
- `assertProofOfWork` / `issueProofOfWorkChallenge` stay synchronous (bitvocation and the lightning layer call them without `await`), so they sign with `getCachedCookieSecret()`; auth's own endpoints call `await resolveCookieSecret()` first. Nostr challenge helpers (`issueNostrChallenge`, `verifyNostrChallenge`) are async.

## Cross-References

- Root project instructions: `/Users/radu/Projects/nuxt-apps/AGENTS.md`.
- Related layers to inspect when relevant: `layers/database`, `layers/admin_workspace`, and any consuming app layer stack.
