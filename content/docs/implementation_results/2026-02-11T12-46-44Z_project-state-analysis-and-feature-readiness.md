# Project State Analysis and Feature Readiness

## Scope
- Selected target: `layers/content`
- Reviewed:
  - Layer source (`app`, `server`, `utils`, `tests`, `scripts`)
  - Layer docs (`layers/content/docs`, `layers/content/docs/specs`, `layers/content/docs/implementation_results`)
  - Root docs relevant to content testing/inventory (`docs/testing/*`, `docs/content_layer.md`)
  - Monorepo docs distribution and latest updates (apps/layers/cli/root)

## Current State Summary
- `layers/content` is a mature shared layer with broad capabilities:
  - Content page CRUD + history in CouchDB
  - Route middleware prefetch / ignore-prefix logic
  - Builder + node editor (search/filter/highlight/refactor completed in phases)
  - Runtime renderer (`<Content>`) with component registry integration
  - Sitemap generation with runtime/app-config route filtering
  - Local image library endpoints + ImageKit integration flows
  - Codex sessions admin integration (`/admin/ai-ops`) with secure proxy routes
- Docs are extensive and recent:
  - `132` markdown files directly under `layers/content/docs`
  - `63` implementation result entries
  - `22` spec docs
- Code footprint is non-trivial:
  - `101` TS/Vue/MJS source files in `layers/content` (excluding docs)
  - `17` server API handlers in `layers/content/server/api`

## Past Work Trajectory (from docs)
- 2025-09 to 2025-11: core content architecture, middleware, builder evolution, array/object/rich-text support, extraction into reusable layer.
- 2025-12: node editor refactor and focused test work.
- 2026-01: runtime ignore-prefix behavior hardening, social image/meta composables, admin workbench UX updates, Codex sessions admin integration.
- 2026-02 (repo-wide): active work continues in other modules/apps (especially `apps/couchfusioncom` and `layers/lightning`), meaning this monorepo remains actively changing.

## Key Readiness Signals
- Strong architecture/documentation baseline for continuing feature delivery in `layers/content`.
- Testing strategy is documented in detail and shared CouchDB harness exists.
- Important feature areas already modularized (node-editor subcomponents/composables, metadata composables, registry scripts).

## Blocking / High-Risk Items Before New Feature Work
1. Test runner path/config mismatch:
   - `layers/vitest.config.ts` uses `setupFiles: ["./_tests/setup/content.ts"]` while the setup file lives at `layers/_tests/setup/content.ts`.
   - Running `bunx vitest --config layers/vitest.config.ts` from repo root currently fails with:
     - missing setup file path
     - missing `jsdom` package for jsdom suites
   - Impact: no reliable pre/post-change regression safety for `layers/content`.

2. Middleware regression/quality issue:
   - `layers/content/app/middleware/content.global.ts` contains a typo in API 404 status message:
     - `"API endpoint not foundX1"`
   - Impact: user-facing/debug noise and likely accidental leftover from interim changes.

3. Test plan drift vs implementation state:
   - `layers/content/docs/specs/testing_plan.md` still has unchecked major items (local-images, sitemap coverage, CI orchestration, broader utility unit coverage).
   - Impact: feature additions in those surfaces remain under-tested.

## Concrete Evidence References
- Test config path: `layers/vitest.config.ts:25`
- Middleware typo: `layers/content/app/middleware/content.global.ts:46`
- Content API integration tests import setup via relative `../../_tests/...`: `layers/content/tests/api-content-pages.spec.ts:2`
- Test plan open tasks:
  - `layers/content/docs/specs/testing_plan.md:35`
  - `layers/content/docs/specs/testing_plan.md:40`
  - `layers/content/docs/specs/testing_plan.md:41`
  - `layers/content/docs/specs/testing_plan.md:61`

## Feature Implementation Readiness Plan
1. Stabilize test execution path first:
   - fix `setupFiles` resolution in `layers/vitest.config.ts`
   - ensure `jsdom` is available for jsdom suites
   - constrain include globs if needed to avoid unintended cross-app test pickup
2. Apply quick hygiene patch:
   - fix middleware typo (`not foundX1` -> `not found`)
3. Add minimum missing coverage before broad feature changes:
   - sitemap handler integration test
   - local-images handler integration tests
   - utility tests for ignore-prefix/path logic
4. Then start feature delivery with per-feature docs + implementation result logs.

## Operational Notes
- Current git working tree has unrelated untracked folders at root:
  - `cli-agent-wrap/`, `cmd/`, `internal/`, `skills/`
- No changes were made outside `layers/content/docs/implementation_results` for this analysis task.
