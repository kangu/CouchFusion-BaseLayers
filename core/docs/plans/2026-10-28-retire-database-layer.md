# Plan: retire `#database`, move everything onto `#core`

Status: proposed, 2026-10-28. Nothing in this plan has been executed yet.

## Goal

No layer or app imports `#database` or extends `layers/database`. Every CouchDB call goes through `#core` with an explicit client, and the database layer is deleted. A check in the shared test suite fails if `#database` reappears.

## Where we are

| | Count |
| --- | --- |
| `#database` imports | 297, in 11 layers (133) and 13 apps (164) |
| Configs that `extends` the database layer | 25 (5 layers: auth, content, orders, lightning, analytics; 20 apps) |
| Startup plugins that provision databases | 9 (auth, content, lightning, orders; couchfusioncom, feedback-tool, pacanele-dashboard, recipes, tulin-delivery) |

Imports by owner: bitvocation 56, pacanele-dashboard 36, content 27, events 25, couchfusioncom 25, lightning 23, maintenance 22, tulin-delivery 14, auth 13, feedback-tool 13, orders 12, client-consultant-feedback 6, lovable-gifts-sdd 5, email 4, analytics 4, ylemreef 3, recipes 2, and one each in sms, sitemap-xml, imagekit, smart-lead, radustanciu, mindarchy, kangu.

Four functions dominate: `getDocument` is imported in 119 files, `putDocument` in 108, `getView` in 60, `getSession` in 27. The full list, per file and per function, is in [database-imports-inventory.txt](database-imports-inventory.txt).

## How old calls map to core

Core operations take an explicit client first; the old ones picked up admin credentials (or `COUCHDB_URL`) implicitly.

| Old (`#database`) | Core | Kind |
| --- | --- | --- |
| `getDocument(db, id, config?)`, `putDocument`, `deleteDocument`, `getView`, `getAllDocs`, `bulkDocs`, `getDocumentWithAttachments`, `*LocalDocument`, `*Attachment`, `createDatabase` | same names in `#core/server/operations`, called as `fn(createServiceClient(), db, …)` | Mechanical (codemod) |
| Types `CouchDBDocument`, `CouchDBDesignDocument`, `CouchDBViewResponse`, `CouchDBDocumentWithAttachments` | same names in `#core/server/operations` | Mechanical |
| `couchDBRequest(fullUrl, init)` | `createServiceClient().request(path, init)` (relative path) | Manual: strip the base URL |
| `getSession({ authSessionCookie })` | in a request: `currentUser(event)` / `requireUser` / `requireRoles` from `#core/server/auth`; otherwise `createSessionClient({}, cookie).json('/_session')` | Manual: also picks up the 12-month remembered login |
| `validateCouchDBEnvironment()` | `getBootstrapConfig()` (throws when `COUCHDB_ADMIN_AUTH` is missing) | Manual |
| `initializeDatabase(db, designs)` | `initializeDatabase(client, db, security, designs)`, which needs an explicit security object | Manual + decision 1 |
| `buildCouchEnvSection`, `normalizeCouchEnvSlug`, `parseCouchConfigString`, `resolveRuntimeAppSlug` | core config helpers (moved to `#core/server/config`, see phase 0) | Mechanical |
| `readCouchConfigValue(s)`, `writeCouchConfigValue` | same names with a client first | Mechanical |
| `generateAuthSessionCookie`, `authenticate`, `createUser`, `logout`, `CouchDBSession` | core auth (`responseAfterLogin`, session endpoints) plus a new admin-only `createUser` in core | Manual, part of the auth step |

Behaviour that changes on purpose: old reads returned `null` on any failure; core returns `null` only for a missing document and throws on denied access, conflicts and outages. Callers that treated "error" as "missing" will now surface errors. Each migrated module gets a quick review of those paths.

## Decisions needed before starting

1. **Startup provisioning.** Nine plugins create databases and design documents on boot. Core's rule is explicit provisioning (`pnpm provision`, dry-run first). Options: (a) keep startup provisioning but route it through core's `initializeDatabase` with an explicit security object per database; (b) move every one of them to a provisioning config run at deploy. Recommendation: (a) now, so the migration doesn't change deploy steps, and (b) as a later cleanup.
2. **`COUCHDB_URL`.** Core only talks to `http://localhost:5984`. kangu reads `COUCHDB_URL` into its own runtime config, and several READMEs document it. If any production app reaches CouchDB elsewhere, core needs an optional URL setting before that app moves. Recommendation: confirm every deployment runs CouchDB on localhost (the githooker template suggests so); otherwise add `COUCHDB_URL` to `getBootstrapConfig`.
3. **The auth layer.** It extends the database layer and nearly every app extends it. Options: (a) keep the auth layer's public API and only swap its internals to core (this plan), then retire it in a separate plan; (b) move all apps to core's auth now. Recommendation: (a). It keeps this migration about data access, not about changing how 20 apps sign in.

## Phases

Each phase ends with: the touched layer or app builds (in a temporary copy, like core's Nuxt tests, so running dev servers are not disturbed), its own tests pass, and a smoke run against local CouchDB.

### Phase 0: make core ready (core only)

- Move the config helpers from `core/utils/couch-config.ts` into `src/server/config.ts` so they import as `#core/server/config` (today they sit outside the `#core` alias).
- Add `createUser(client, payload)` to core operations, admin-only, never writing `_admin` or roles without the caller passing them.
- Codemod script `scripts/migrate-database-imports.ts`: dry-run by default, rewrites the mechanical rows of the table above to `#core` imports with a module-level `createServiceClient()`, and lists every call it can't rewrite (manual rows, calls passing a custom `config`). `--apply` writes.
- Admin integration that the remaining modules need:
  - core reads the legacy `appConfig.adminWorkspace.sections` contract, and collects sections at `modules:done`, so a module's nav appears whatever the module order;
  - the core sidebar always keeps its own Overview link next to module sections;
  - a page meta flag (`couchdbPublic`) lets a module publish a login-free page under `/admin` (analytics share links).
- A test in `layers/_tests` that fails when any file outside `layers/database` imports `#database`, with an allow-list that shrinks to zero by phase 5.

### Phase 1: analytics, the pilot (4 imports)

Swap `couchDBRequest` (2), `getSession` and the config helpers to core; drop `extends: ['../database']` and use `#core` instead. Then link it into cf-cloud:
- extend `layers/analytics`, set `public.analytics.admin.enabled` and `public.appSlug: 'cf-cloud'`;
- add `apexcharts` to cf-cloud (the time chart imports it);
- render the dashboard in the Terminal theme by mapping its `--cfa-*` variables onto core's `--cf-*` tokens inside `.cf-ui`, with figures in the mono, square-ish 6px cards and the ink primary button; light/dark then follow the toggle automatically;
- admin access stays gated by core's admin roles; `analytics_viewer` users can't open `/admin` in cf-cloud (documented).

Note: one website per app, so cf-cloud's dashboard shows cf-cloud's own (near-empty) traffic. Showing other sites' analytics would need a multi-site engine, which the analytics layer deliberately doesn't have.

### Phase 2: small layers (7 imports)

email (4), sms, sitemap-xml, imagekit (1 each). Mostly config helpers and `getDocument`.

### Phase 3: feature layers (109 imports)

orders (12), maintenance (22), lightning (23), events (25), content (27), in that order: smallest blast radius first, content last because most apps use it. Their startup plugins follow decision 1. Drop `extends: ['../database']` from orders, lightning and content.

### Phase 4: auth layer internals (13 imports)

Swap auth's reads and writes to core operations and its session check to core's `currentUser`, keeping the `#auth` API unchanged. Drop its `extends: ['../database']`. This is the step most apps feel, so it gets its own release and a sign-in smoke test in bitvocation, couchfusioncom and kangu.

### Phase 5: apps (164 imports)

Per app: add `extends` for core (database-only by default, so it changes nothing else), run the codemod, fix the manual list, drop the database extend, build and smoke-test. Order by size: kangu, radustanciu, mindarchy, smart-lead (1 each), recipes, ylemreef, lovable-gifts-sdd, client-consultant-feedback, feedback-tool, tulin-delivery, couchfusioncom, pacanele-dashboard, bitvocation. Apps that only extend `database` with no imports (forest-cabin, kids-store, gas-maintenance, sample-auth, ping-pong-events, lovable-test, pacanele-landing, nuxt-app-starter) only lose the extend.

tulin-delivery imports `#database/utils/couchdb.server`, which does not exist in the database layer; check whether those 14 imports build today before migrating them.

### Phase 6: delete the database layer

Remove `layers/database`; the Data Sync page lives on as core's `admin.dataSync` (still needs its Tailwind-free restyle). Shrink the guard test's allow-list to empty. Update every `agents.md` that mentions the database layer.

## Risks

- **Errors that used to read as "missing"** now throw (see above). Mitigation: review each module's null-handling as it moves; smoke-test the main flows.
- **Env names:** core reads only `COUCHDB_ADMIN_AUTH`; the old layer also accepted `NUXT_COUCHDB_ADMIN_AUTH`. No deploy config in the repo uses the `NUXT_` name, but check servers before phase 4.
- **Other people's work in progress:** the analytics layer (and others) have uncommitted changes. Each phase starts by checking `git status` for the files it touches and coordinating before editing them.
- **Order of module hooks:** solved in phase 0 by collecting admin sections at `modules:done`.

## Estimate

Phase 0 and 1 are one working session. Phases 2–4 are a session each. Phase 5 is mostly mechanical after the codemod: one to two sessions, dominated by bitvocation and pacanele-dashboard. Phase 6 is short.
