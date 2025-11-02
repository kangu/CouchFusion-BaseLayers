# Content Layer Testing Plan

## Context
- Scope covers all server APIs exposed by `layers/content` (pages CRUD, history, admin links, local images, sitemap) and their supporting utilities (auth/session guards, CouchDB helpers, middleware-side effects).
- Testing stack is limited to Vitest for unit/integration coverage and Playwright for end-to-end flows, matching the wider monorepo conventions.
- CouchDB setup is inexpensive and available in test environments, so plans assume fully provisioned databases with design docs to mirror production behaviour.

## Phase 1 – Endpoint Inventory & Fixture Modeling
- Catalogue every HTTP surface: `/api/content/pages` (GET, POST, PUT, DELETE, history), `/api/content/admin-links`, `/api/content/local-images` (GET/POST/DELETE), `/api/sitemap.xml`, plus builder-related live-update emitters where applicable.
- Record per-endpoint prerequisites (admin vs auth roles, required query/body payloads), side effects (history snapshots, file system writes), and dependent utilities.
- Define canonical fixtures for page documents, navigation metadata, and image uploads to reuse across Vitest suites and Playwright scenarios.

## Phase 2 – CouchDB Test Environment
- Create a shared helper that uses the existing running CouchDB instance with credentials sourced from `runtimeConfig.dbLoginPrefix` that has a "test-" prefix appended to the value.
- Re-use `initializeDatabase` plus `contentDesignDocument` to seed the `_design/content` views before each suite; expose helpers for bulk seeding page docs/history snapshots.
- Provide cleanup hooks that remove the test database after each suite to avoid cross-test residue; leverage CouchDB’s database deletion since environment cost is negligible.
- Document environment variables (`COUCHDB_URL`, `COUCHDB_USERNAME`, `COUCHDB_PASSWORD`, `NUXT_DB_LOGIN_PREFIX`) and bake them into Vitest’s `setupFiles` and Playwright `globalSetup`.

## Phase 3 – Vitest Coverage
- Unit-test pure utilities (`normalizePagePath`, `resolveIgnoredPrefixes`, `savePageHistory`, `local-images` helpers) with deterministic fixtures and temporary directories where required.
- Integration-test API handlers by importing H3 event handlers directly, constructing mock events via `createEvent`/`createFetch`, and injecting AuthSession cookies that map to seeded CouchDB `_users` docs with `admin` / `auth` roles.
- Write end-to-end-ish integration tests that hit the running Nitro server (using `nuxt/test-utils` and `fetch` against `localFetch`) to cover:
  - `/api/content/pages` fetches (index + by path), POST (create), PUT (update), DELETE (remove), and history retrieval, asserting CouchDB side effects.
  - `/api/content/admin-links` access control (auth role required) and response hydration from registered links.
  - `/api/content/local-images` upload/list/delete, using a tmp directory wired via `process.cwd()` override or dependency injection, asserting file lifecycle.
  - `/api/sitemap.xml` XML generation with seeded routes, excluded prefixes, and navigation flags.
- Stub or seed dependencies as needed (e.g. register admin links via `ensureDefaultAdminLink`, pre-populate file system) and assert both success and failure branches (missing auth, validation errors).

## Phase 4 – Playwright Scenarios
- Extend existing Playwright config to spin up CouchDB alongside the Nuxt dev server (`bun run dev`, default port 3000 unless overridden), waiting for both health checks before executing specs.
- Author specs that drive real UI flows which exercise the APIs:
  1. Admin signs in, creates a page via builder/inline editor, verifies CouchDB document and history endpoint responses.
  2. Edit an existing page and confirm live updates propagate to the rendered page (leveraging `useContentLiveUpdates`).
  3. Upload and delete local images through the admin UI, validating gallery updates and backend DELETE behaviour.
  4. Visit `/sitemap.xml`, parse XML, and confirm newly created pages appear while ignored prefixes do not.
- Reset CouchDB state between specs (database drop + re-seed) to guarantee deterministic runs; capture screenshots and traces on failure.

## Phase 5 – CI Orchestration & Coverage Reporting
- Integrate CouchDB service into CI pipelines (GitHub Actions service container or reusable workflow) with credentials injected into both Vitest and Playwright jobs.
- Run Vitest suites first with coverage thresholds tailored per package (track statements/branches for API handlers); publish coverage reports as artifacts.
- Execute Playwright specs afterwards, uploading HTML reports and ensuring retries for flakes; fail pipeline on persistent failures.
- Document developer workflow: local `bun vitest --runInBand` for deterministic API tests, `bun playwright test` for browser runs, and guidance on using seeded fixtures.

## Future Implementation Checklist
- [ ] Add Vitest environment bootstrap (CouchDB container + Nuxt test harness).
- [ ] Implement unit/integration specs per endpoint and utility.
- [ ] Extend Playwright suite with admin content flows and sitemap validation.
- [ ] Wire CI jobs with CouchDB service, coverage publishing, and artifact retention.
- [ ] Update developer onboarding docs once the suite ships.
