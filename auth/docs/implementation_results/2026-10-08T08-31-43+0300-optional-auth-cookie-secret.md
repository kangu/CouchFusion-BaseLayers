# Initial Prompt
Build fails because the auth layer unconditionally requires COUCHDB_COOKIE_SECRET. Make it optional because it is needed for passwordless login.

# Plan
1. Trace startup validation and all auth cookie-secret consumers.
2. Remove unconditional build/startup requirement while preserving passwordless request-time checks.
3. Verify the ready hook without a secret and remaining required configuration checks; update layer documentation.

# Proposed Next Steps
Retry bun run build. Configure a cookie secret at runtime only if using passwordless email or Nostr login. Proof-of-work signing still requires its own configured signing secret when enabled.

# Implementation Summary
Removed unconditional cookie-secret environment check in shared layers/auth/nuxt.config.ts. Existing email and Nostr session generation guards remain unchanged, so missing configuration cannot mint a session. Required dbLoginPrefix and CouchDB admin credential validation remain. Updated layers/auth/agents.md to describe the optional startup secret accurately.

# Verification
Executed the actual ready hook in an isolated Node VM with no cookie-secret environment variable: passed. Missing prefix, absent admin auth and malformed admin auth still reject. Verified both passwordless session endpoints retain secret checks. No build, lint, or server restart performed. Mindarchy CLI remains unavailable; no handoff sent.
