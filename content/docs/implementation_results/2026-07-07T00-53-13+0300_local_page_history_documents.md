# Local Page History Documents

## Summary
Refactored page save history so snapshots are stored as CouchDB `_local` documents instead of normal `oldpage-*` documents. Snapshot ids now keep the page id plus timestamp suffix, without the `oldpage-` prefix, for example `_local/page-/about-2026-07-07T00:00:00.000Z`.

## Changes
- Added shared CouchDB `_local` helpers in `layers/database/utils/couchdb.ts` for get, put, and delete operations.
- Updated `layers/content/server/utils/page-history.ts` to save snapshots under `_local/page-...-{timestamp}` ids and maintain a per-page `_local/page-history-index-...` document because local docs are not design-view queryable.
- Increased retained history snapshots from 3 to 5.
- Removed the obsolete `history_by_path` design-doc view.
- Kept the existing history API response shape so the workbench and node editor continue reading history entries through the current store flow.

## Verification
- Passed: `PATH="/Users/radu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ./node_modules/.bin/vitest --config vitest.config.ts content/tests/api-content-pages.spec.ts --run --reporter=dot`
- Broader `content/tests` run reached 128 passing tests, then failed 2 existing translation-menu tests due to a test path resolving `/Users/radu/Projects/nuxt-apps/layers/app/components/admin/ContentAdminWorkbench.vue` instead of the content layer path.
