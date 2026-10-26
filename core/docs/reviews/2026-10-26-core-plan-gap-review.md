# Core layer: refactoring-plan and legacy-parity review

Date: 2026-10-26. Branch: feat/merged-couchdb in both repositories.
Reviewed layer baseline: efcd5f3. App baseline: eb26c6c.

## Conclusion

Core is a working first implementation of database-only composition and cf-cloud native-password/SSR/admin adoption. It is not yet a complete replacement for database, auth and admin_workspace. Important differences are genuine regressions or unfinished plan commitments; others are deliberate architectural improvements whose consuming-app adapters have not been built.

The current green tests establish less than complete legacy parity. This review reran the 53 offline tests and backend/module TypeScript check successfully on supported Node 24.22.1. It performed source comparison and offline mocked probes only: no CouchDB writes, external messages, package installation, production-code changes or application migrations.

## Highest-priority findings

### 1. Existing database initialization replaces security and is not idempotent

Priority: high before using provisioning on existing databases.

[Core initialization](/Users/radu/Projects/nuxt-apps/layers/core/src/server/operations.ts:328) calls createDatabase and then always writes _security, including when creation receives 412/already-exists. [Legacy initialization](/Users/radu/Projects/nuxt-apps/layers/database/utils/couchdb.ts:891) only assigned initial security to newly created databases. Task 9 and the design explicitly prohibited existing policy rewrites.

An offline fake-server probe reproduced requests `PUT /existing` -> 412, followed by `PUT /existing/_security`. The public initialization helper has no separate replace-existing-security opt-in. Although CLI --apply prints an explicit desired policy, preserving existing security must be a separate deliberate operation rather than an implicit initialization side effect.

[Design-document upsert](/Users/radu/Projects/nuxt-apps/layers/core/src/server/operations.ts:314) also always PUTs after GET, even when content is identical. Legacy compared content before writing. The probe confirmed an unchanged document still receives a PUT. Repeated provision runs therefore create revisions rather than becoming a no-op.

Remaining: distinguish creation from existence; preserve existing policy by default; require an explicit policy-update action; restore normalized design comparison; test two consecutive applications against owned scratch resources.

### 2. Existing prefixed accounts lose their short-name password login

Priority: migration blocker for prefixed-account consumers; not a failure of cf-cloud's exact-name test.

[Core password handler](/Users/radu/Projects/nuxt-apps/layers/core/src/features/login-password/server/login.post.ts:25) forwards body.name unchanged. [Legacy handler](/Users/radu/Projects/nuxt-apps/layers/auth/server/api/login-with-password.post.ts:31) trims and tries the configured prefix plus the supplied username, then the exact name. A database account `bv-alice` previously accepting `alice` now requires its full database name, despite auth_user_prefix being configured.

Remaining: choose and implement an explicit normalized/prefixed username contract, preserve the exact-name administrator fallback if desired, and test short names, full names and whitespace. Neither current nor legacy actual password handler creates accounts automatically; unused legacy imports must not be mistaken for active signup behavior.

### 3. Passwordless provisioning and preflight are incomplete

Priority: migration/deployment blocker for a fresh Nostr-enabled deployment.

[Provision script](/Users/radu/Projects/nuxt-apps/layers/core/scripts/provision.ts:18) only provisions a caller-described non-system database. It cannot install selected auth design documents into _users. [Nostr lookup](/Users/radu/Projects/nuxt-apps/layers/core/src/features/login-nostr/server/backend.ts:39) still requires `_users/_design/auth/_view/by_nostr_npub`. A developer machine already initialized by the old auth plugin can hide this dependency.

[Preflight](/Users/radu/Projects/nuxt-apps/layers/core/scripts/preflight.ts:14) checks one database's existence, not enabled-feature prerequisites. It does not check required views, token/challenge stores, signing-policy compatibility, or method-specific settings; a missing database (404) does not set a failing exit code.

[Settings resolution](/Users/radu/Projects/nuxt-apps/layers/core/src/options.ts:177) also accepts enabled email with an empty token database/signing secret. Offline probe confirmed this is accepted as effective configuration rather than rejected at readiness. Request-time service errors do not replace the planned actionable feature-aware preflight.

Remaining: an explicit selected-feature provisioning/preflight contract, versioned auth designs, required-store and signing-policy checks, real idempotence tests, and the promised expired-challenge cleanup action. This does not require restoring automatic startup writes.

### 4. Legacy email delivery and application metadata adapters are missing

Priority: migration blocker for deployments using the existing token watcher.

Core correctly requires an explicit emailDeliveryHandler and stores hashed cryptographic codes. However, the planned legacy-watcher adapter and metadata hook were never implemented. [Core token record](/Users/radu/Projects/nuxt-apps/layers/core/src/features/login-email/server/service.ts:100) uses codeHash/createdAt/expiresAt. The [existing watcher](/Users/radu/Projects/nuxt-apps/cli-configs-bitvocation/config-logins.json:59) filters `used:false` and builds `/confirm-login/{{doc.email}}/{{doc.code}}` links. Redirecting that watcher to the new database cannot produce valid messages or confirmation links.

Legacy funnel/affiliate attribution from [login.post.ts](/Users/radu/Projects/nuxt-apps/layers/auth/server/api/login.post.ts:102) is not carried by the new request/delivery interfaces. Product fields should stay outside core, but Task 6/10's replacement application adapters must exist before those consumers migrate.

Remaining: a concrete delivery adapter and confirmation-page/API translation; an explicit strategy for watcher migration without undoing hashed-at-rest codes; application metadata adapters; captured-delivery and real passwordless session-issuance tests. No external messages are needed for these tests.

### 5. Generic page protection and live-user client integration are unfinished

Priority: required before treating core as a general auth-layer replacement.

The [global middleware](/Users/radu/Projects/nuxt-apps/layers/core/src/features/auth-client/app/middleware/session.global.ts:12) hydrates request-local state and protects the /admin prefix. There are no named replacements for legacy auth/admin_auth/role_auth or its role metadata contract. Non-admin protected pages require new explicit guards; changing extends alone does not preserve their protection.

The live-user server/follower and sanitized endpoint exist, but no core client opens EventSource or applies those updates to useCouchDBAuth. [The composable](/Users/radu/Projects/nuxt-apps/layers/core/src/features/auth-client/app/composables/useCouchDBAuth.ts:83) provides explicit refresh; it does not subscribe. Enabling liveUsers currently starts server work without automatically updating browser roles/profile/session state.

Remaining: generic route-auth/role contracts plus optional client subscription lifecycle, reconnect/cleanup and deletion/role-change handling. Decide deliberately which profile fields belong in consuming apps. Test revocation/update behavior across an actual running server and browser.

### 6. Stable admin header and navigation contracts are broken

Priority: migration blockers for custom admin pages and contributed navigation.

[useAdminWorkspaceHeaderTitle](/Users/radu/Projects/nuxt-apps/layers/core/src/features/admin/app/composables/useCouchDBAdminTitle.ts:7) is an alias of a no-argument ref getter. Original `useAdminWorkspaceHeaderTitle(title/ref/getter)` reacted to its argument and associated the title with the route. Existing calls now ignore their argument at runtime or fail typechecking, contrary to Task 7's explicit preservation requirement.

[Module contribution collection](/Users/radu/Projects/nuxt-apps/layers/core/module.ts:24) runs during core setup and prepends contributions before explicit app sections. [Navigation deduplication](/Users/radu/Projects/nuxt-apps/layers/core/src/features/admin/app/utils/navigation.ts:13) keeps the first section/item. Offline probe with a shared route and app override retained the shared title/label, so app overrides do not win as planned. Modules registering contribution hooks later may also miss the collection event. The hook is not type-augmented; callHook uses `as any`.

Existing [content navigation](/Users/radu/Projects/nuxt-apps/layers/content/nuxt.config.ts:84) still uses appConfig.adminWorkspace.sections, which core does not import. None of those producers has been migrated to the new hook.

Remaining: restore the title argument/route contract; collect contributions after modules can register; define typed hooks and deterministic override precedence; migrate producers or add the temporary importer promised in Task 7; test actual module ordering and custom layouts.

### 7. Configuration validation and immutability are incomplete

Priority: correctness before expanding deployment profiles.

[Local defaults](/Users/radu/Projects/nuxt-apps/layers/core/src/options.ts:82) are spread directly into effective configuration; numeric and enum validation largely checks only remote keys. The offline probe accepted tokenTtlSeconds=-1, sessionMaxAgeSeconds=0 and theme='invalid'. Explicit optional-config fallback therefore need not produce validated defaults, despite the contract.

[The worker snapshot](/Users/radu/Projects/nuxt-apps/layers/core/src/server/settings.ts:9) freezes only its outer object. Nested feature flags, roles, admin sections, auth settings and secrets remain writable and shared with later requests.

Remaining: validate the final merged settings through one registry/schema, validate enabled-provider prerequisites, and deeply freeze or defensively isolate the resolved policy. Preserve the single-variable bootstrap and client-safe projection already implemented.

## Legacy functionality coverage

| Area | Core status | Remaining decision/work |
| --- | --- | --- |
| Explicit database clients, CRUD/local docs, queries, bulk, attachments | Largely extracted | Live tests must exercise these exports; finish API/signature translation and semantic edge cases |
| Database security/design initialization | Implemented with regressions | Existing-policy preservation and idempotence |
| Flat cf_env runtime configuration | Working main path | Effective-value validation, feature prerequisites, deep immutability, missing deployment cases |
| Native exact-name password login, session/logout, role guards | Implemented; cf-cloud adopted | Prefix/normalization parity and generic page protection |
| Email code login | New service/UI/adapter interface exists | Actual delivery integration, confirmation contract and metadata adapters; full runtime tests |
| Nostr linked-account signed challenge | Implemented with stronger durable state | Required designs/preflight, real signature/issued-cookie/runtime tests and consumer API migration |
| Live-user updates | Server half implemented | Browser EventSource wiring and reactive application behavior |
| Admin shell/navigation/header | Functional minimal replacement | Preserve stable APIs and contribution overrides; decide original shell feature parity |
| Data Sync | Seven handlers/UI ported and gated | Enabled HTTPS end-to-end tests, persistent-job status, safe/force cases and attachment limits |
| Provisioning/preflight | Generic CLI skeleton | Selected-feature designs/stores/policy checks and challenge cleanup |
| Consumer migration | cf-cloud only | Shared layer producers/imports, other app profiles, external watcher configs and removal criteria |

## Original admin workspace: omissions needing explicit decisions

The new shell is self-contained and removes mandatory Pinia/Tailwind/icon dependencies, which is useful. It also omits original functionality beyond styling:

- SiteLogo and ToastNotification component integration, item icon rendering despite accepting item.icon.
- Desktop collapse, persisted/prepaint sidebar state, long-section folding and section tabs.
- Profile menu/Edit Profile action and navigation-derived header labels.
- Original themeClass support, ledger CSS/font setup, and admin-theme-dependent login styling. Core's ledger/classic are simplified replacement skins; login has separate fixed styles.
- Original useSidebarNavigation and planned useCouchDBAdminNavigation exported contracts.
- Mobile Escape dismissal/body-scroll locking and related interaction tests.

Custom app-workspace layouts/pages can retain their paths because the module avoids overriding existing ones, but that alone does not migrate their store/composable/component dependencies. Decide what is retained, replaced through slots/adapters, or explicitly retired; do not label all omissions required code without that product decision.

## Nostr clarification: correct the earlier parity framing

Legacy auth's actual challenge/verify handlers already authenticate existing linked accounts using signed events. Missing DM transport is not evidence that core removed an active DM-login flow. Legacy nostr-config/profile utilities exist, but their mere presence is not a call path.

The active DM integration found in this review is [events/nostr-notifications.ts](/Users/radu/Projects/nuxt-apps/layers/events/server/utils/nostr-notifications.ts:432), importing #auth/server/utils/nostr-config. Core parses relay/DM/sender settings but does not provide that consumer adapter. Migrate that integration or remove/rescope its misleading core configuration inputs. Treat unused legacy helpers separately from proven live functionality.

## Data Sync: inherited limitation versus missing verification

Single-document sync fetches JSON without inline attachment bytes and copies _attachments stubs. A target missing those bytes may reject the write. This is inherited from legacy code and is already disclosed in core/README.md; it is not a new regression or an undocumented finding. Task 8 still requires explicit regression tests or an implemented byte-transfer strategy. Native database replication is the attachment-preserving path.

The synchronous local /_replicate test does not validate the UI's persistent _replicator jobs, job updates/status/errors, remote HTTPS, safe/force document copies or a second deployment. Keep those claims separate.

## Plan completion matrix

| Task | Assessment | Unfinished acceptance |
| --- | --- | --- |
| 1 — fast harness/inventory | Partial | Cleanup-failure/concurrency/interrupt recovery tests; real per-consumer inventory; timing breakdowns |
| 2 — typed module contract | Mostly present | Typed contribution hook; complete effective/default/feature requirement validation |
| 3 — runtime config | Partial | Deep immutable policy, effective validation, prerequisite readiness, deployment-failure matrix |
| 4 — server core/registration | Mostly extracted | Full export semantics/migration mapping; actual package-absent isolation and registration tests |
| 5 — native auth/client | cf-cloud path implemented | Prefixed accounts, generic named guards, migration adapters |
| 6 — email/Nostr/PoW | Partial | Watcher/metadata adapters, prerequisite provisioning and real multi-worker/provider tests |
| 7 — system admin workspace | Partial | Header/navigation regressions; contribution migration; explicit original shell feature decisions |
| 8 — Data Sync | Ported, incompletely verified | Enabled TLS/persistent-job/safe-force/attachment tests |
| 9 — live updates/provisioning | Partial | Client stream, selected auth designs/stores, useful preflight, idempotence and cleanup |
| 10 — consumer migration | Not completed | Only cf-cloud extends core; existing layers/apps still depend on legacy aliases/config/routes |
| 11 — capability/deployment matrix | Partial | Runtime optional-feature matrices, physically absent optional packages, two workers/restarts/outage scenarios |
| 12 — documentation/adoption | cf-cloud adopted; docs partial | Real migration guide/profiles and accepted removal decisions; update stale inventory/status text |

The plan's unchecked boxes cannot serve as current status: some completed steps remain unchecked and others remain unimplemented. Use this matrix to revise executable tasks rather than marking the full plan complete from the smoke path.

## What current tests establish—and what they do not

Confirmed in this review: 53 offline tests pass and backend/module TypeScript checks pass on Node 24.22.1. No live/database/provider tests were rerun for this read-only audit.

Source inspection shows:

- The local primitive suite calls raw localRequest, not exported operation helpers. It proves the local server's primitives, not complete implementation parity.
- The Nuxt suite exercises password/admin/SSR, including anonymous/non-admin access and CSRF. It does not exercise enabled email, Nostr, Data Sync, stream behavior or old custom layouts.
- Feature matrix profiles build; they do not start the optional-feature servers. They symlink the same node_modules containing optional dev dependencies. Checking output package.json does not prove builds with those packages physically absent; no outbound-network blocker is installed.
- Registration unit tests exercise a standalone featureManifest helper, not the actual module registration function; the helper can diverge from module.ts.
- Provider replay tests use one-process in-memory fakes, not two Nitro workers and restart durability. Real signed-cookie acceptance through passwordless handlers is not covered by the current Nuxt suite.
- Cleanup tests validate namespaces/headers/config, but not the full failure/interruption/concurrent-cleanup matrix promised by Task 1.
- Browser screenshots and compilation do not establish old admin interaction/visual parity. The backend-only tsconfig excludes app source, so its green result is not a full Vue/client typecheck.

## Intentional changes to retain

These are good architectural changes, not missing parity by themselves:

- One explicit feature-configured layer with database-only defaults.
- Separate server service and caller-cookie clients; no client credential exposure.
- Automatic request-local SSR state and independently guarded server APIs.
- No implicit startup database writes, broad API CORS, future-dated session cookies or persistent browser passwords.
- Cryptographic/hash-at-rest email codes and durable challenge consumption.
- Product/affiliate/profile concerns outside generic core state.

They still need migration contracts where old consumers depended on the replaced interfaces. Do not restore old unsafe behavior solely to make old tests pass.

## Recommended completion order

1. Fix provisioning existing-policy preservation/idempotence and effective config validation/immutability.
2. Restore prefix-aware login, generic auth/role guards and stable admin title/navigation contracts.
3. Finish selected-feature provisioning/preflight plus email delivery/metadata integration.
4. Wire live-user client behavior and finish enabled-feature runtime/integration tests.
5. Agree which original admin shell features are required, then restore/adapt and test them.
6. Build actual per-consumer migration profiles and migrate shared contributions/aliases before retiring old layers.

Keep the existing cf-cloud password/SSR/admin regression suite green through these changes. Do not remove the original three layers until actual consumer inventory and acceptance checks allow it.
