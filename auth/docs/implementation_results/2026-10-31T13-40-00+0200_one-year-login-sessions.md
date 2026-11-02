# One-year login sessions

Date: 2026-10-31. Applies to every app that extends the auth layer.

## Problem

Builder sessions ended about 10 minutes after login, however active the user was. CouchDB accepts an `AuthSession` cookie while `stamp + [chttpd_auth] timeout` is in the future (timeout 600 s by default) and normally renews it by sending a new cookie on each request. The app's server talks to CouchDB itself, so that renewed cookie never reached the browser. Password login passed on CouchDB's own 600 s cookie. Email and Nostr login already minted their own cookie stamped about 69 days ahead, but without `Max-Age`, so the browser dropped it when the session ended.

## Change

- `server/utils/session-cookie.ts` — `issueSessionCookie(event, userDoc)` issues a cookie stamped `maxAge` ahead (so CouchDB accepts it that long without any server-wide setting) with `Max-Age=maxAge`, `HttpOnly`, `SameSite=Lax` (`Secure` in production).
- Used by `login-with-password.post.ts` (after CouchDB has checked the password), `login-verify.post.ts` (email link) and `auth/nostr/verify.post.ts`. Password login falls back to CouchDB's short cookie, with a warning, only if no cookie secret is available.
- Length, first match wins: CouchDB `_config` `cf_env_<slug>.auth_session_max_age_seconds` → `runtimeConfig.authSessionMaxAgeSeconds` (`NUXT_AUTH_SESSION_MAX_AGE_SECONDS`) → one year. Values below 600 s are raised to 600. Cached for 5 minutes.
- Cookie secret: `COUCHDB_COOKIE_SECRET` / `NUXT_COUCHDB_COOKIE_SECRET` when set, otherwise CouchDB's own `chttpd_auth/secret` (then `couch_httpd_auth/secret`), read with the admin credentials. Email login checks this before consuming the token.
- Database layer: `generateAuthSessionCookie(..., { maxAgeSeconds })` adds `Max-Age`; `authenticate()` also returns the session's user `name`. The missing-secret startup warning now says sessions use CouchDB's secret.
- No CouchDB server setting is changed, so other apps on the same CouchDB keep their behaviour.

## Security notes

- Logout clears the browser cookie only. A copied cookie stays valid until it expires, unless that user's password is changed (new salt) or CouchDB's `chttpd_auth/secret` is rotated (which logs out everyone).
- Shorten it per app with `auth_session_max_age_seconds` in `cf_env_<slug>` if one year is too long for that app.

## Server admins: CouchDB checks the admin salt

CouchDB (3.5.0 source, same on hetzner1's 3.5.2 and hydra1's 3.5.3) signs and checks cookies as `HMAC(hash_algorithm, chttpd_auth/secret ++ salt, "<name>:<STAMP-HEX>")`, base64url, with `hash_algorithms = "sha256, sha"` tried in order. Nothing changed there in 3.5.x. But it looks the user up in `[admins]` before `_users`, so for a name that is also a server admin (here `radu`) the salt is the one in the admin password hash (`-pbkdf2:sha256-<key>,<salt>,<iterations>`), not the `_users` document's.

The first version used the `_users` salt, so CouchDB rejected the cookie: the password was accepted but `GET /api/login` answered 401 and the login form did not move on. Fix:

- `resolveCookieSalt(name, docSalt)` reads `_config/admins/<name>` first and uses its salt; otherwise the `_users` salt. (Applies to email and Nostr login too.)
- `issueSessionCookie` checks every cookie with CouchDB `GET /_session` before sending it. If CouchDB rejects it, password login falls back to CouchDB's own (short) cookie with a warning; email/Nostr login answer 500 instead of handing out a dead cookie.
- Checked on hydra1 from the box: cookies signed with the admin salt are accepted (sha256 and sha1, stamped now and one year ahead); with the `_users` salt every variant is rejected.

Note: a login as a name that is also a server admin gets CouchDB role `_admin`, as before this change.

## Verification

- `server/utils/session-cookie.spec.ts`: precedence, minimum, caching, secret fallback, admin-salt parsing and order, the CouchDB acceptance check, cookie stamp/HMAC/`Max-Age`. With the existing auth and database specs: 26 tests pass (the two `bun:test` files under `app/utils` don't run under vitest, as before).
- hydra1, first version: cookie persistent with 365 days left, `HttpOnly`, `SameSite=Lax`, but rejected by CouchDB (see above).
- hydra1, with the admin-salt fix: password sign-in in Chrome Canary moves on to the builder; the `AuthSession` cookie is persistent with 365 days left, `HttpOnly`, `SameSite=Lax`; `GET /api/login` answers 200; no fallback warning in the log.
- Checked natively against CouchDB on hydra1, using only the browser's cookie (piped from Canary over SSH, never printed or stored), more than 10 minutes after sign-in: `GET /_session` → `ok`, `userCtx.name = radu`, roles `_admin, admin`, no refresh cookie needed. Protected endpoints answer 200 with the cookie and 401 without it: `/_users/org.couchdb.user:radu`, `/_users/_all_docs`, `/_all_dbs`, `/_node/_local/_config/chttpd_auth/hash_algorithms`. A tampered cookie gets 401. The app's `GET /api/login` still answers 200 twelve minutes after sign-in (the old sessions died at 10).
