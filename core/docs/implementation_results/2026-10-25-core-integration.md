# Core integration result

Created layers/core as a self-contained integration of database utilities, optional login/session UI, system admin shell, optional Data Sync, email/PoW/Nostr and own-user SSE registration. cf-cloud extends only core and enables native password login/admin with CouchDB runtime settings.

No existing consumer or old layer was modified. Backend uses explicit service versus caller clients, automatic request-scoped SSR session middleware, direct server role checks, session-bound multi-worker CSRF, and native session maximum-age enforcement. No automatic provisioning or global CORS.

Verification includes unit tests, backend typecheck, real local CouchDB 3.5.2 temporary-resource tests, isolated production SSR/password/admin tests, optional feature builds and real browser login/reload/logout. See app implementation_results for exact latest counts/results. Review findings fixed with regression coverage: Data Sync CSRF header propagation and immediate programmatic relogin after logout. Optional relay/DM transport and Data Sync document attachment-copy parity remain explicitly limited in README.
