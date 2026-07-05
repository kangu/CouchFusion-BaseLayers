# Layer: database

`Runtime: nuxt 4.1.x, vue 3.5.x`

Shared CouchDB foundation layer for the CouchFusion monorepo. Provides a typed CouchDB client (auth, sessions, documents, attachments, design docs, bulk ops, views), a `_config` environment reader, and a Data Sync admin page. Consumed (via `extends` in `apps/*/nuxt.config.ts`) by: bitvocation, feedback-tool, forest-cabin, gas-maintenance, indux, kangu, kids-store, nuxt-app-starter, pacanele-dashboard, pacanele-landing, ping-pong-events, radustanciu, sample-auth, smart-lead, tulin-delivery.

## Folder map

- `utils/` — core exports: `couchdb.ts` (CouchDB client + types), `couch-config.ts` (`_config` env reader), `register-layout.ts` (Nuxt module registering admin nav).
- `server/api/datasync/` — endpoints: `replicate.post.ts`, `compare-docs.post.ts`, `remote-dbs.post.ts`, `db-info/`, `replication-status/`, `doc/`.
- `server/plugins/app-slug-log.ts` — logs resolved app slug at startup.
- `pages/admin/datasync.vue` — Data Sync admin page.
- `docs/` — implementation notes + `implementation_results/` subfolder.
- `nuxt.config.ts` — registers `#database` alias and the `register-layout` module.
- `README.md` — high-level overview.
- `.spec.ts` files live next to source (e.g. `utils/couch-config.spec.ts`).

## Public API / Exports

- Alias: `#database` — import via `#database/utils/couchdb`, `#database/utils/couch-config`.
- Auto-imported utils (Nuxt `imports` resolves `utils/`): `couchDBRequest`, `testDatabaseConnection`, `createDatabase`, `getDefaultDatabaseSecurity`, `setDatabaseSecurity`, `getDocument`, `getDocumentWithAttachments`, `getView`, `getAllDocs`, `createUser`, `putDocument`, `deleteDocument`, `bulkDocs`, `createOrUpdateDesignDocument`, `initializeDatabase`, `authenticate`, `getSession`, `generateAuthSessionCookie`, `verifyAuthSessionValue`, `putAttachment`, `getAttachment`, `deleteAttachment`, `logout`, `validateCouchDBEnvironment`.
- `_config` reader (`utils/couch-config.ts`): `parseCouchConfigString`, `normalizeCouchEnvSlug`, `buildCouchEnvSection` (`cf_env_<slug>`), `resolveRuntimeAppSlug`, `readCouchConfigValue`, `readCouchConfigValues`, `writeCouchConfigValue`.
- Types: `CouchDBDocument`, `CouchDBDesignDocument`, `CouchDBView`, `CouchDBViewResponse`, `CouchDBUserDocument`, `CouchDBSessionResponse`, `CouchDBAttachment`, `CouchDBDatabaseInfo`, `CouchDBSecurityObject`, etc.
- Server endpoints under `/api/datasync/*`.
- Admin nav: registers `database` section with `/admin/datasync` route (requires `admin` role).
- Nuxt module: `register-layout` (default export `registerDatabaseLayoutModule`).

## Conventions

- Use the `#database` alias for cross-layer imports, not relative paths.
- Layer config goes in CouchDB `_config` under section `cf_env_<app-slug>` (see root AGENTS.md); prefer `readCouchConfigValue` over `process.env`.
- Keep spec files colocated with source (`*.spec.ts`).
- Never import from a consuming app into this layer.
- Don't duplicate CouchDB client logic in other layers — extend this one.

## Dependencies

- Runtime peerDeps: `nuxt ^4.0.0`, `@vueuse/core ^13.9.0`.
- Bundled dep: `@noble/hashes` (HMAC auth-session cookies).
- No other layer depends on this layer; it is the base for `auth`, `email`, `events`, `imagekit` (via `#auth` and direct imports).
- Expects consuming apps to provide a running CouchDB instance and `runtimeConfig` CouchDB env keys.

## Build / Test commands

- No standalone lint/typecheck script in the layer's `package.json`.
- Layer tests run through the root layers vitest: `vitest run --root layers/database` or, from repo root, `npx vitest run layers/database` using `layers/vitest.config.ts`.
- Full typecheck/lint is performed in a consuming app (e.g. `apps/bitvocation`): `bun run typecheck` / `bun run lint`.

## Gotchas / Pitfalls

- `couchdb.ts` exports many symbols — import via `#database/utils/couchdb` to avoid Nuxt auto-import collisions.
- `resolveRuntimeAppSlug` resolves the consuming app's slug; default slug is the app folder name. See `cf_env_<slug>` convention in root AGENTS.md.
- Admin nav registration runs as a Nuxt module in `utils/register-layout.ts`; edits require re-running the dev server.
- HMAC auth-session cookie keys are tied to `@noble/hashes` — keep the dep version aligned across apps.
- Data Sync endpoints hit remote CouchDB directly; CORS and credentials must be configured on the remote instance.
- `app-slug-log.ts` logs at startup — useful for debugging layout resolution, not a runtime concern.

## Cross-references

- Root conventions: `/Users/radu/Projects/nuxt-apps/AGENTS.md`
- Layer docs: `docs/` (especially `datasync_functionality.md`, `couchdb_logout_internals.md`, `2026-03-08T15-16-42Z_couchdb-config-env-reader.md`)
- Related skills: `couchfusion-layer-builder`, `couchfusion-app-builder`
- Consumers: see `apps/*/nuxt.config.ts` `extends` arrays
