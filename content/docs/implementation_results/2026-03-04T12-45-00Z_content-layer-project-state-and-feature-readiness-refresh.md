# Content Layer Project State and Feature Readiness Refresh (2026-03-04)

## Scope
- Target: `layers/content`
- Objective: analyze current state, review past work from docs folders, and prepare implementation readiness for upcoming features.

## Documentation Review Performed
### Layer-local docs reviewed (`layers/content/docs`)
- Recent baseline and status docs:
  - `implementation_results/2026-02-26T19-56-16Z_content-layer-project-state-and-feature-readiness.md`
  - `content-layer-status-review.md`
  - `schema_gaps.md`
  - `specs/testing_plan.md`
- Most recent implementation work (2026-03-02 to 2026-03-03):
  - inline preview motion control removals/hard-disable
  - ContentImageField UX adjustments and confirmation flows
  - ImageKit transform persistence + parser/template fixes
  - ImageKit zoom (`z`) support in content controls

### Cross-folder docs reviewed
- Root docs:
  - `docs/content_layer.md`
  - `docs/component_registry_per_project.md`
  - `docs/testing/content-layer-phase1-inventory.md`
- Related layer docs due active dependency surface:
  - `layers/imagekit/docs/2026-03-03T06-17-52Z_transform-merge-extract-whitelist-helpers.md`
  - `layers/imagekit/docs/2026-03-03T06-44-11Z_imagekit-transform-whitelist-add-z.md`
  - `layers/imagekit/docs/2026-03-03T06-51-58Z_imagekit-directive-fixed-dynamic-transform-merge.md`

## Current Codebase Footprint (live)
- Content layer source files (`.ts/.vue/.mjs`, excluding docs): **101**
- Content server API handlers: **16**
- Content test specs: **6**
- Content docs markdown files: **243**
  - specs: **22**
  - implementation_results: **88**

## Live Verification Results (2026-03-04)
### 1) Root-level Vitest invocation is still broken
Command:
- `bunx vitest --config layers/vitest.config.ts --run` (from repo root)

Observed failures:
- setup path resolves incorrectly from root (`/_tests/setup/content.ts` expected by config, file exists at `layers/_tests/setup/content.ts`)
- test discovery includes unrelated external/symlinked app paths (`apps/indux`)
- jsdom package resolution fails in this invocation mode

### 2) Layers workspace invocation passes
Command:
- `bunx vitest --config vitest.config.ts --run` (from `/layers`)

Result:
- **6 test files passed, 23 tests passed**
- confirms content layer API/builder/runtime tests are currently green when executed with the intended config root and available CouchDB

## Functional State Summary
### Stable/implemented surfaces
- Content page lifecycle: list/read/create/update/delete + history
- Global content middleware with prefix filtering and API path guard behavior
- Builder/NodeEditor stack with search, dialog flows, highlight behavior
- Inline live editor handshake and focus workflows
- Local images API and image library integration
- Sitemap static route enrichment modules
- Codex session API surface in content layer

### Recent feature direction (from latest logs)
- Builder UX hardening (confirmation actions, panel defaults)
- Motion override simplification (removed toggle plumbing)
- ImageKit transform model maturation:
  - transform parsing/persistence fixes
  - dynamic per-image transform propagation
  - zoom transform support
  - cross-layer whitelist/merge helper alignment in `layers/imagekit`

## Risks and Gaps Requiring Attention Before New Feature Waves
1. Test ergonomics at monorepo root are unreliable
- root-level test command is currently misleading/failing even when layer-local tests pass.

2. Testing plan doc is partially stale
- `specs/testing_plan.md` still references `/api/content/admin-links`, which is not present in current handlers.

3. Known schema mismatch concerns remain valid
- `schema_gaps.md` observations still align with current code in:
  - `types/content-page.ts`
  - `utils/page-documents.ts`
  - `server/utils/content-documents.ts`
- notable examples: stem derivation strategy, strict boolean `navigation`, seo shape narrowing.

4. Coupling to CouchDB test harness remains broad
- current setup (`layers/_tests/setup/content.ts`) bootstraps DB for all content suites, including UI-adjacent tests.

## Feature Implementation Readiness
Overall readiness: **Good for incremental feature delivery**, with one operational caveat.

- Architecture and feature surfaces are mature.
- Recent changes show active maintenance and compatibility work.
- Automated tests are passing in the correct execution context.
- Primary operational caveat: establish and document canonical test execution from `layers/` (or harden root config paths/globs).

## Prepared Execution Plan for Next Feature Work
1. Lock execution baseline
- Use `cd layers && bunx vitest --config vitest.config.ts --run` as pre/post-change validation path.
- Optionally normalize root config pathing and include globs for monorepo-safe invocation.

2. Prioritize schema-alignment hardening
- align `stem`, `navigation`, and seo extensibility decisions with target Nuxt Content contract.

3. Keep image transform behavior centralized
- continue using shared `layers/imagekit/utils/transform.ts` helpers for merge/sanitize rules.

4. Update testing plan docs to match actual API surface
- remove obsolete endpoints and split DB-required vs pure-unit suites where possible.

## Consuming Apps Snapshot (content layer usage)
Apps currently extending `../../layers/content` include:
- `bitvocation`
- `couchfusioncom`
- `kangu`
- `nuxt-app-starter`
- `pacanele-landing`
- `radustanciu`
- `smart-lead`
- `testing-1`
- `tulin-delivery`

This confirms layer changes have wide blast radius and should continue to be validated at layer level first, then in target app(s).
