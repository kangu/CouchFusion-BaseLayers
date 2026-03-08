# Initial Prompt
Set up extensive automated tests to ensure content-layer functionality does not break when upgrading minimark, using these reference live docs as baseline fixtures:
- http://localhost:5984/rs--content/page-%2Findex
- http://localhost:5984/couchfusion-com--content/page-%2F
- http://localhost:5984/bv--content/page-%2Fsurvey-2024

# Plan
1. Capture deterministic fixture snapshots from the three live CouchDB reference docs.
2. Add a refresh script so fixtures can be regenerated on demand.
3. Add baseline minimark API regression tests (`toHast`, `fromHast`, `visit`) against these fixtures.
4. Add rendering regression tests via `Content.vue` with proxy components to validate:
   - top-level custom component render counts
   - named/default slot rendering behavior
   - bound `:prop` JSON parsing into objects/arrays
   - SSR output parity checks.
5. Ensure tests are located in `layers/content` and runnable pre/post-upgrade.

# Implementation Summary
Implemented fixture-driven regression testing in `layers/content`:

## Fixture refresh utility
- Added script:
  - `layers/content/scripts/refresh-minimark-upgrade-fixtures.mjs`
- Script fetches the 3 live documents from CouchDB and writes normalized fixtures to:
  - `layers/content/tests/fixtures/minimark-upgrade/rs-index.json`
  - `layers/content/tests/fixtures/minimark-upgrade/couchfusion-home.json`
  - `layers/content/tests/fixtures/minimark-upgrade/bitvocation-survey-2024.json`
- Normalization removes volatile metadata (`updatedAtByLocale`) and keeps rendering-relevant document structure.

## New regression test suites
- Added baseline minimark behavior tests:
  - `layers/content/tests/runtime/minimark-upgrade-baseline.spec.ts`
- Coverage:
  - fixture top-level tag structure
  - custom-tag set expectations
  - `toHast` output child counts
  - `fromHast(toHast(...))` roundtrip equality
  - `visit` traversal count invariants
  - `visit` replacement behavior for text nodes

- Added runtime rendering regression tests:
  - `layers/content/tests/runtime/minimark-upgrade-rendering.spec.ts`
- Coverage:
  - custom component mapping for all fixture custom tags
  - top-level rendered component count invariants (per fixture)
  - named/default slot rendering checks
  - SSR rendering checks with same component map
  - bound JSON prop parsing checks for key real-world components:
    - `landing` / `phil` from rs fixture
    - `home-hero` from couchfusion fixture
    - `survey-form` from bitvocation fixture

## Vitest compatibility fix for runtime components
- Added `#imports` stub module:
  - `layers/_tests/stubs/imports.ts`
- Updated alias config in:
  - `layers/vitest.config.ts`
- This allows runtime `Content.vue` tests to resolve Nuxt composables consistently under Vitest.

## Validation executed
Executed from `/Users/radu/Projects/nuxt-apps/layers`:
- `bunx vitest --config vitest.config.ts content/tests/runtime/minimark-upgrade-baseline.spec.ts --run` (pass)
- `bunx vitest --config vitest.config.ts content/tests/runtime/minimark-upgrade-rendering.spec.ts --run` (pass)
- `bunx vitest --config vitest.config.ts content/tests/runtime/minimark-upgrade-baseline.spec.ts content/tests/runtime/minimark-upgrade-rendering.spec.ts --run` (pass)

# Next Steps
1. Before upgrading minimark, optionally refresh fixtures if you want the latest production-like baseline:
   - `node layers/content/scripts/refresh-minimark-upgrade-fixtures.mjs`
2. Upgrade minimark.
3. Re-run both regression suites from `/layers` and compare results.
4. If failures occur, treat them as upgrade regressions unless fixture refresh or expected-behavior change is intentional.
