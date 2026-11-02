# Persistent sign-in for 12 months (2026-10-28)

## Problem

People were signed out after about 10 minutes, and whenever the browser closed.

- The layer's own `auth_session_max_age_seconds` (default 600) rejected native sessions older than 10 minutes, even when CouchDB still accepted them. On this server CouchDB keeps sessions far longer: `couch_httpd_auth/timeout` is 55225800 s (about 21 months); `chttpd_auth/timeout` is unset.
- The `AuthSession` cookie had no Max-Age, so it ended with the browser session.
- CouchDB's renewed cookie (sent once 10% of its timeout has passed) was never passed on to the browser.

The session was never meant to live in local storage: it stays in HttpOnly cookies so page scripts cannot read it.

## Change

- New setting `auth_remember_seconds` (0..31536000, default 31536000). At login the server sets `AuthSession` and `couchdb_remember`, both HttpOnly, SameSite=Lax, Secure on https, Max-Age 12 months.
- `couchdb_remember` (`src/server/remember.ts`) holds the username, issue and expiry times, signed with a key derived from CouchDB's `chttpd_auth` secret plus the user's `_users` salt. Changing the password or rotating the secret invalidates it; the expiry is fixed at 12 months from sign-in (not sliding).
- `currentUser`: a valid native session is accepted (the 10-minute age check is skipped while a remembered login exists) and CouchDB's renewal is passed on. When the native session is missing or rejected, a valid remembered login mints a fresh native session (CouchDB's own HMAC scheme, confirmed with `/_session`, roles re-read). An invalid one clears both cookies.
- CSRF tokens bind to the remembered login (stable for its life) instead of the rotating `AuthSession`.
- Logout clears both cookies. Email and Nostr sign-in get the same behaviour through `responseAfterLogin`.
- Options generated before this setting existed fall back to the default instead of failing validation.
- No CouchDB server setting was changed.

## Checks

- Unit: 115 passed (token expiry, password and secret changes, forged user or dates, malformed and future tokens; setting range, default, stale options).
- Nuxt (real build + local CouchDB): 6 passed, including 12-month cookies, restore from the remembered login alone, unchanged CSRF token, tampered cookie rejected and cleared, logout clearing both.
- Dev server with sessions dated in the past: 11-minute-old session kept with the remembered login and refused without it (the old bug); a session past the server's timeout restored with a new 12-month cookie and the same CSRF token.
- Browser: sign in, reload, sign out through the UI, then `/admin` redirects to login. Neither cookie is visible to page scripts.
- `pnpm test:matrix`: all builds pass.

## Not exercised live

Passing on CouchDB's renewed cookie: on this server CouchDB renews only after about 64 days, so this path is covered by code, not by a live test.
