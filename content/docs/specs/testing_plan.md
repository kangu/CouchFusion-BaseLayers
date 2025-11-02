# Content Layer Testing Plan

## Context
- Scope covers all server APIs exposed by `layers/content` (pages CRUD, history, admin links, local images, sitemap) and their supporting utilities (auth/session guards, CouchDB helpers, middleware-side effects).
- Testing stack is limited to Vitest for unit/integration coverage and Playwright for end-to-end flows, matching the wider monorepo conventions.
- CouchDB setup is inexpensive and available in test environments, so plans assume fully provisioned databases with design docs to mirror production behaviour.

## Phase 1 – Endpoint Inventory & Fixture Modeling
- [x] Catalogue every HTTP surface: `/api/content/pages` (GET, POST, PUT, DELETE, history), `/api/content/local-images` (GET/POST/DELETE), `/api/sitemap.xml`, plus builder-related live-update emitters where applicable. → Documented in `docs/testing/content-layer-phase1-inventory.md`.
- [x] Record per-endpoint prerequisites (admin vs auth roles, required query/body payloads), side effects (history snapshots, file system writes), and dependent utilities.
- [x] Define canonical fixtures for page documents, navigation metadata, and image uploads to reuse across Vitest suites and Playwright scenarios.

## Test Infrastructure Architecture (Monorepo)
- Maintain a shared `layers/_tests/` workspace containing:
  - `layers/_tests/utils/` – reusable CouchDB bootstrap helpers, H3 event builders, auth session fabricators, filesystem utilities.
  - `layers/_tests/fixtures/` – canonical JSON documents, history snapshots, binary assets (e.g. demo images) reused by multiple layers.
  - Layer-specific entrypoints (`layers/_tests/setup/content.ts`, `layers/_tests/setup/auth.ts`, etc.) that re-export shared helpers and provide layer seeds.
- Configure `layers/vitest.config.ts` with one project per layer (e.g. `layers/content`, `layers/auth`). Each project references the shared utilities via setup files (`../_tests/setup/<layer>.ts`), letting CouchDB-aware layers opt into the bootstrap while lighter layers skip it.
- Adopt a single `playwright.config.ts` that defines projects per app, using metadata flags (e.g. `requiresCouch: true`) inside `globalSetup` to decide whether to provision CouchDB. Shared Playwright setup lives under `layers/_tests/setup/playwright/`.
- Standardise environment isolation helpers so CouchDB databases and temp file directories receive deterministic prefixes (`test-${namespace}-${runId}`), avoiding cross-layer clashes.
- Provide package scripts such as `bun vitest --workspace layers` and `bun vitest --run --project content` for targeted runs, plus `bun playwright test` leveraging the unified config.
- Document the workflow so additional layers can adopt the shared infrastructure with minimal bespoke configuration.

### Seed Helper Library
- `layers/_tests/fixtures/content.ts` builds seeded page documents (with optional history snapshots) and exports `seedContentPages` for Vitest/Playwright suites.
- `layers/_tests/fixtures/auth.ts` offers convenience helpers (`seedAdminUser`, `seedAuthorUser`, `seedUserWithRoles`) that delegate to the shared harness for user creation and session cookies.

## Phase 2 – CouchDB Test Environment
- [x] Create a shared helper (`layers/_tests/utils/couchdb.ts`) that provisions namespaced CouchDB databases using admin credentials, generates `dbLoginPrefix` values, and exposes teardown hooks.
- [x] Re-use `initializeDatabase` plus design documents (e.g. `contentDesignDocument`) to seed required views; harness exposes `seedDocuments` for fixtures.
- [x] Provide cleanup hooks that drop databases and remove test users after each suite; Playwright helpers (`layers/_tests/setup/playwright/*`) share the harness registry.
- [x] Document the required environment variables and Vitest/Playwright wiring (`docs/testing/couchdb-test-harness.md`, `layers/vitest.config.ts`, `layers/_tests/setup/content.ts`).

## Phase 3 – Vitest Coverage
- [ ] Unit-test pure utilities (`normalizePagePath`, `resolveIgnoredPrefixes`, `savePageHistory`, `local-images` helpers) with deterministic fixtures and temporary directories where required.
- [x] Integration-test API handlers by importing H3 event handlers directly, constructing mock events, and injecting AuthSession cookies that map to seeded CouchDB `_users` docs with `admin` / `auth` roles.
- [ ] Extend coverage to additional surfaces:
  - [x] `/api/content/pages` fetches (index + by path), POST (create), PUT (update), DELETE (remove), and history retrieval, asserting CouchDB side effects.
  - [ ] `/api/content/admin-links` access control (auth role required) and response hydration from registered links.
  - [ ] `/api/content/local-images` upload/list/delete, using a tmp directory wired via `process.cwd()` override or dependency injection, asserting file lifecycle.
  - [ ] `/api/sitemap.xml` XML generation with seeded routes, excluded prefixes, and navigation flags.
- [x] Stubbed Nuxt/H3 primitives (`#imports`, `h3`) to allow direct invocation of handlers within Vitest while reusing CouchDB seed helpers.

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
