# login-verify: stop leaking password hashes

## Problem

`POST /api/login-verify` returned `{ resp, doc }`:
- `doc` was the raw value of the `_users/_design/auth/has_account_case_insensitive` view, i.e. the full CouchDB `_users` document, including `derived_key`, `salt`, `password_scheme`, `iterations` and `pbkdf2_prf`.
- `resp` was the full login-token document.

Every successful email-code login sent this password-hash material to the browser. The token was also marked used only after the cookie was issued, so two concurrent requests with the same code could both get a session.

## Changes (`server/api/login-verify.post.ts`)

- **Response:** `{ success: true, resp: { funnel }, doc: sanitizeUserDoc(userDoc) }`. This keeps the shape `apps/bitvocation` reads (`resp.funnel || doc.funnel`). It drops password fields (via the existing `server/utils/sanitizeUserDoc.ts`) and the token document.
- **Token use:** the token is now marked used *before* the cookie is generated. `putDocument` sends the fetched `_rev`, so a concurrent reuse gets a conflict and an `Invalid login` 404, and no cookie.
- **Cookie:** now carries `SameSite=Lax` in addition to the existing `Version=1; Path=/; HttpOnly` (+ `Secure` in production).
- **Input:** the email is trimmed and lowercased, and the code trimmed and uppercased, to match how `login.post.ts` and `login-token.ts` create token IDs.
- **Cleanup:** removed the unused `getSession` round-trip.

## Deliberately unchanged

The cookie lifetime is unchanged. It is still stamped 6,000,000 s ahead (now the named constant `SESSION_STAMP_OFFSET_SECONDS`), giving roughly 69 days plus CouchDB's timeout, with no `Max-Age`. Aligning it with `chttpd_auth/timeout` would sign Bitvocation users out after CouchDB's timeout (600 s by default) unless sessions are refreshed. That is a product decision, not part of this fix.

## Verification

- New `server/api/login-verify.post.spec.ts` (5 tests, mocked `#database`, served through h3) checks:
  - no hash fields, salt, code or expiry appear in the response body;
  - the response keeps the Bitvocation shape;
  - the cookie has `HttpOnly` and `SameSite=Lax`;
  - mixed-case input works;
  - a code works only once;
  - a concurrent consumption issues no cookie;
  - expired and unknown codes are rejected.

  Run it from `layers/`:

  ```sh
  node_modules/.bin/vitest --config vitest.config.ts auth/server/api/login-verify.post.spec.ts --run
  ```

  Running from the repo root fails, because `setupFiles` is resolved relative to the cwd.
- `apps/bitvocation`: `bunx vue-tsc --noEmit` reported no errors for this file.
- Already failing before this change: `apps/bitvocation/tests/auth/default-affiliate-opt-in.spec.ts` expects `allow_affiliate: true` in this file. The committed version doesn't contain it either; this endpoint does not create accounts.
