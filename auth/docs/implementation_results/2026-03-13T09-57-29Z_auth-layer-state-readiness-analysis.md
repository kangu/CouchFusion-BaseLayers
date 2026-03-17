# Initial Prompt
Analyse the current project state thoroughly considering all aspects involved, review the past work from /docs folders and prepare to implement work on features.

# Scope
- Selected target: `layers/auth`.
- Reviewed `layers/auth` implementation, `layers/auth/docs/*`, `layers/auth/docs/implementation_results/*`, and auth-related records from root `docs/`.
- Mapped current auth-layer consumers from `apps/*/nuxt.config.ts`.

# What Was Audited
1. Layer architecture and runtime contract
- `layers/auth/nuxt.config.ts`
- `layers/auth/README.md`
- Plugin registration, middleware, store, server API routes, server plugins, server utilities.

2. Historical implementation trail (auth layer docs)
- Users API, login/logout/auth middleware, real-time session updates, role middleware, referral support, admin-session helper extraction.

3. Cross-project documentation context (root docs)
- Auth flow usage in feedback-tool.
- Shared testing harness direction and auth-cookie usage in content layer testing docs.
- Recent root-level implementation_results entries for architecture trends.

# Current Layer State (As-Is)
## Strengths
- Layer provides end-to-end auth primitives: login routes, session lookup, logout, role middleware, admin guard, user listing, and design-doc initialization.
- Realtime user-change pipeline exists with global `_users/_changes` follower and client fan-out.
- Several apps already consume this layer, indicating broad integration footprint.

## Historical trajectory (from docs)
- 2025-08 to 2025-11: major auth capabilities landed incrementally (users API, realtime updates, build hang fix, login route availability, role middleware, admin-session helper reuse).
- Root docs show auth was reused in multiple app contexts (not only one app), but with repeated notes about cookie/session and guard behavior.

# Risks and Gaps Before New Feature Work
## P0 (fix before extending features)
1. Realtime sanitizer drops required identifiers.
- In `sanitizeUserDoc`, `_id` and `_rev` are deleted, then re-read from sanitized object.
- Result can emit undefined identifiers to SSE clients.

2. Login token persistence bypasses configured CouchDB host/auth.
- `login.post.ts` writes to hardcoded `http://localhost:5984/${DB}` via raw `$fetch`.
- This breaks non-localhost and diverges from shared `#database/utils/couchdb` auth/config path.

## P1 (high priority)
1. Docs/implementation drift around realtime transport.
- Current runtime route is SSE (`server/routes/live-events.ts`), while README and historical docs still describe WebSocket `/ws` transport and files that are no longer present.
- This increases implementation mistakes for new feature work.

2. Sensitive token logging.
- `validateCouchSession` logs raw token value.

3. Runtime env contract is stricter than necessary and partly inconsistent.
- Build-time hook validates `process.env.COUCHDB_ADMIN_AUTH` explicitly, while deployment patterns may rely on runtime overrides (`NUXT_*`) and app-level config conventions.

## P2 (medium priority)
1. Missing automated tests for auth layer behaviors.
- No direct test files currently under `layers/auth`.
- Existing shared harness can support this, but auth suite is not yet present.

2. Mixed auth story (password + email token + SSE nomenclature) lacks one canonical contract doc.

# Consumer Footprint Snapshot
Apps extending `layers/auth` include:
- `bitvocation`, `couchfusioncom`, `feedback-tool`, `forest-cabin`, `kangu`, `nuxt-app-starter`, `pacanele-dashboard`, `pacanele-landing`, `radustanciu`, `sample-auth`, `smart-lead`, `testing-1`, `tulin-delivery`.

This means layer-level regressions have high blast radius; stabilization-first is recommended.

# Readiness Plan for Upcoming Feature Work
## Phase 1: Stabilization (recommended first)
1. Fix sanitizer identifier handling and add unit coverage.
2. Replace hardcoded CouchDB write in login token route with database-layer utility/configured URL.
3. Remove token logging from session validation.
4. Reconcile realtime docs to current SSE implementation (or intentionally reintroduce websocket if desired).

## Phase 2: Contract hardening
1. Define and adopt typed token document contract (base + extension strategy).
2. Normalize API response typings for auth store endpoints and tighten route-level types.
3. Consolidate auth environment/runtime requirements into one implementation contract doc.

## Phase 3: Testability and rollout safety
1. Add auth-layer test suite using shared CouchDB harness:
- `/api/login` session resolution
- `/api/logout` cookie clearing
- `/api/users` admin authorization + prefix filtering
- realtime fan-out sanity checks
2. Add smoke matrix for at least two consuming apps (one content-heavy, one dashboard-style).

# Blockers Encountered During Validation
- Attempted `npx nuxi typecheck` inside `layers/auth` required network install and then failed with:
  - `Cannot resolve module "@nuxt/kit"` (layer folder is not a standalone Nuxt workspace for typecheck execution).
- Conclusion: typecheck should be run from a consuming app workspace or configured monorepo script.

# Recommended Next Task Entry Point
Start with a stabilization ticket bundle in this order:
1. sanitizer fix + tests
2. login token persistence refactor (remove localhost hardcode)
3. docs reconciliation (SSE vs WebSocket and route naming)

This sequence reduces regression risk before adding net-new features.
