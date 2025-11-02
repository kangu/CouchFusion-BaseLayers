# Testing Plan – Phase 2 Harness

## Initial Prompt
```
Proceed with Phase 2
```

## Implementation Summary
Implementation Summary: Built a shared CouchDB test harness (layers/_tests/utils/couchdb.ts) with layer setup files, Vitest workspace wiring, and Playwright bootstrap stubs so suites can provision and clean isolated databases automatically.

## Documentation Overview
- Added `layers/_tests/utils/couchdb.ts` to provision namespaced databases, seed documents, and manage temporary CouchDB users, returning run-specific `dbLoginPrefix` values.
- Introduced `layers/_tests/setup/content.ts` plus Playwright setup/teardown scripts to reuse the harness, setting `NUXT_DB_LOGIN_PREFIX` for the content layer during tests.
- Registered the layer in `layers/vitest.config.ts` and documented usage in `docs/testing/couchdb-test-harness.md`, ensuring the testing plan (`layers/content/docs/specs/testing_plan.md`) captures the new infrastructure.

## Implementation Examples
- `layers/_tests/utils/couchdb.ts:1` – shared harness factory with cleanup hooks and user helpers.
- `layers/_tests/setup/content.ts:1` – Vitest setup that initialises the content database and updates runtime env prior to specs.
- `layers/_tests/setup/playwright/global.ts:1` – prototype global setup that provisions CouchDB for Playwright projects flagged with `metadata.requiresCouch`.
