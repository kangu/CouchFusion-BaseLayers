# Login codes and brute-force limits

## Problem

Found while assessing 2FA for `apps/paleologu-prosti`:

- `POST /api/login` made the emailed six-letter code with `Math.random()`, which is not a
  cryptographic source (its sequence can be predicted from enough outputs). `login-token.ts`
  (used by the lightning layer) already used `crypto.randomBytes`, but `byte % 26` made A–V about
  10 % more likely than W–Z. Both hardcoded a 60-minute lifetime.
- `POST /api/login-verify` accepted unlimited wrong codes. Requesting a code is gated by
  proof-of-work, guessing one was not.
- `POST /api/login-with-password` accepted unlimited wrong passwords, and each attempt ran
  CouchDB's slow password hash (PBKDF2), so floods also cost CPU.

## Changes

- `server/utils/login-token.ts`:
  - `createLoginCode()`: six uppercase letters from `crypto.randomInt(26)`. Same format, so the
    token id `email--CODE` and the email templates are unchanged.
  - `loginTokenTtlMs()`: lifetime from `runtimeConfig.authLoginTokenTtlMinutes`, 1–1440, default 60.
  - `createLoginToken({ email, funnel, fields })`: optional `fields` (e.g.
    `affiliate_friend_code`), which can't override the token's own fields.
- `server/api/login.post.ts` now stores its token with `createLoginToken`. One generator, one
  lifetime rule.
- `nuxt.config.ts`: `authLoginTokenTtlMinutes` (`NUXT_AUTH_LOGIN_TOKEN_TTL_MINUTES`), default 60.
  The default stays at 60 because the lightning layer emails login tokens with orders, which
  people may open later; admin-only apps can lower it (15 is reasonable).
- `server/utils/login-limits.ts`: `createFailureCounter` (fixed 15-minute window per key, in
  memory per process), the four counters, `resetLoginLimits()` for tests, and `clientAddress()`
  (`X-Real-IP` as overwritten by the CouchFusion Caddy template, else the socket address).
- `POST /api/login-verify`:
  - an address with 30 wrong codes in the window gets 429 before anything is checked;
  - each wrong or expired code counts for its email; on the 5th, all of that email's pending
    codes are marked used (`cancelled: "too-many-wrong-codes"`, via `_all_docs` over the id range
    `email--` … `email--￰`) and the answer is 429 „Too many wrong codes. Request a new
    code.” The count restarts, so a newly requested code works at once;
  - same answers for emails without an account (no account discovery);
  - a successful login resets the email's count (not the address's).
- `POST /api/login-with-password`: 429 after 5 wrong passwords for a username (app prefix and
  case ignored, so `maria` and `BVmaria` share a counter) or 20 from an address, checked before
  `authenticate()`. Success resets the username's count. A username lockout lasts the window; an
  attacker can trigger it for a known username, which is the accepted trade-off.
- Session cookies are unchanged.

## Verification

- `bunx vitest run --config vitest.config.ts auth/server` → 6 files, 37 tests pass:
  - `login-token.spec.ts`: format, all 26 letters within ±20 % over 24 000 letters (no bias),
    `login.post.ts` free of `Math.random`, lifetime default / config / invalid values, stored
    document and extra fields.
  - `login-limits.spec.ts`: counter window, per-key blocking, reset.
  - `login-verify.post.spec.ts` (+4): four misses then the right code (count reset); 5th miss →
    429 with both pending codes cancelled, another email's untouched, the old right code refused,
    a new one accepted; unknown email answers the same; 30 misses from one address → 429 even
    with the right code, other address fine.
  - `login-with-password.post.spec.ts` (new): right password; 5 wrong → 429 for all spellings
    without calling CouchDB; success resets; 20 wrong from an address → 429 there only.
- `lightning/tests/order-fulfillment.spec.ts` (uses `createLoginToken`) → 18 pass.
- Live on `apps/paleologu-prosti` (dev server, real CouchDB `prosti-logins`): a seeded code for a
  test address, five wrong codes → `404 404 404 404 429`; the seeded document became
  `used: true, cancelled: "too-many-wrong-codes"` (so the `_all_docs` range query works on
  CouchDB); the right code then → 404; six wrong passwords → `401 ×5, 429`. Test document deleted.
- Not run live: `POST /api/login` itself (needs a solved proof-of-work); covered by the unit test of
  `createLoginToken` and the source check.

## Notes

- Counters are per process and reset on restart; cancelled codes persist in CouchDB.
- The per-address limits trust `X-Real-IP`: fine behind the CouchFusion Caddy template (it
  overwrites the header) or with the app bound to 127.0.0.1; a client reaching the app directly
  could fake it. The per-email and per-username limits don't depend on it.
