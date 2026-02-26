# Content Layer Project State and Feature Readiness (2026-02-26)

## Scope
- Target selected: `layers/content`
- Reviewed sources:
  - `layers/content` source (app/server/utils/tests)
  - `layers/content/docs` + `layers/content/docs/specs` + `layers/content/docs/implementation_results`
  - root `docs` folder (especially testing/content-layer references)
  - current workspace/test execution state

## High-Level Status
- `layers/content` is active and feature-rich, with major surfaces already implemented:
  - content pages CRUD + history
  - global content middleware + route filtering
  - admin workbench/node editor/inline live editor
  - local image library APIs
  - codex sessions admin tooling
  - sitemap static-route enrichment module
- Documentation coverage is extensive:
  - `layers/content/docs`: **222** markdown files
  - `layers/content/docs/implementation_results`: **67** entries
  - `layers/content/docs/specs`: **22** specs

## Recent Work (latest docs)
Most recent implementation entries in the content layer are:
1. `2026-02-12T05-40-44Z-usecontentliveupdates-jsdoc-pass.md`
2. `2026-02-12T05-24-48Z-inline-focus-conditional-scroll-threshold.md`
3. `2026-02-11T13-23-11Z-inline-focus-handshake-fix.md`
4. `2026-02-11T12-46-44Z_project-state-analysis-and-feature-readiness.md`

Interpretation:
- Latest work concentrates on inline preview focus/handshake reliability and maintainability comments.
- This aligns with a mature builder/runtime where UX reliability is being refined rather than foundational architecture being rebuilt.

## Current Code Surfaces
- Content layer source footprint (excluding docs): **99** TS/Vue/MJS files.
- Server API handlers in content layer: **16**.
- Test specs in content layer: **6** (`api`, `builder`, `runtime`).

### Current API files present
- `server/api/content/pages.{get,post,put,delete}.ts`
- `server/api/content/pages/history.get.ts`
- `server/api/content/local-images/index.{get,post,delete}.ts`
- `server/api/codex-sessions/*` (health/config/index/stream/status/input/stop/delete)

## Root Docs Context
- Root `docs` remains active as historical/cross-project context:
  - `docs/*.md`: **79**
  - `docs/implementation_results/*.md`: **47**
  - `docs/testing/*.md`: **2**
- Root content-layer docs (`docs/content_layer.md`, `docs/testing/*`) still reflect architecture/testing intent and remain useful references.

## Verification Results (live)
Two Vitest runs were executed:

1. From repo root:
- Command: `bunx vitest --config layers/vitest.config.ts --run`
- Result: failed
- Findings:
  - setup path resolves to wrong location (`/_tests/setup/content.ts` expected but actual is under `layers/_tests/setup/content.ts`)
  - test discovery includes unrelated app paths (including symlinked `apps/indux`)
  - `jsdom` resolution fails in this invocation mode

2. From `layers/` directory:
- Command: `bunx vitest --config vitest.config.ts --run`
- Result: failed
- Findings:
  - config/setup resolution is correct in this mode
  - jsdom is available
  - all suites fail early due to CouchDB connection (`EPERM` connecting to `127.0.0.1:5984` / `::1:5984`) in this environment

## Readiness Assessment
Overall: **architecturally ready, execution environment not ready**.

What is ready:
- Feature surfaces are implemented and modular.
- Documentation and implementation history are deep and discoverable.
- Tests exist for API/builder/runtime workflows.

What blocks safe feature velocity right now:
1. Test command ergonomics from monorepo root are brittle (path + discovery scope).
2. Test harness hard-depends on local CouchDB connectivity.
3. `layers/_tests/setup/content.ts` runs for all suites, so even jsdom-only suites are gated by database setup.

## Immediate Pre-Implementation Checklist
Before implementing new features, stabilize this baseline:
1. Normalize Vitest execution strategy:
   - enforce running from `layers/` or fix config pathing to be root-safe.
2. Restrict test include globs to avoid cross-app bleed (`apps/indux` symlink side-effects).
3. Split test setup so DB bootstrap is only applied where needed (API integration suites), not blanket across all suites.
4. Ensure a reachable CouchDB test target (or add conditional skip/fallback for non-DB suites).
5. Reconcile `layers/content/docs/specs/testing_plan.md` with actual current API surfaces (it still references `admin-links`, which does not exist in current handlers).

## Note on Workspace State
- Root worktree contains unrelated untracked directories/files (`.playwright-cli/`, `cli-agent-wrap/`, `cmd/`, `internal/`, `skills/`, `landing-intro-frame-1.png`) which were not modified.
- A symlinked app path exists: `apps/indux -> /Users/radu/Projects/indux/...` and influences broad test globs.
