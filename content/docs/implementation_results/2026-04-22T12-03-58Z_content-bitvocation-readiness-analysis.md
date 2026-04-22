# Initial Prompt
Analyse the current project state thoroughly considering all aspects involved , review the past work from /docs folders and prepare to implement work on features.

# Plan
1. Review the current content-layer responsibilities, docs history, and recent implementation streams.
2. Cross-check active source files in builder, workbench, runtime rendering, inline preview, fonts, and locale metadata.
3. Validate the available test path for the layer and record any environmental blockers.
4. Produce a readiness brief focused on safe extension points and regression-sensitive areas for consumer apps like Bitvocation.

# Implementation Summary
## Baseline
- Target layer: `layers/content`.
- The layer currently owns:
  - runtime content rendering,
  - admin workbench/page management,
  - node editor/builder tooling,
  - inline preview synchronization,
  - font management,
  - locale metadata/flags,
  - translation helpers.

## Docs review conclusions
- Recent layer work is concentrated in:
  - inline preview click/focus behavior,
  - component picker preview scaling and device simulation,
  - global component aliases/defaults,
  - font preview/application flow,
  - locale-aware editing/runtime behavior.
- Current source confirms those themes:
  - `useContentLiveUpdates.ts` remains the main message/focus bridge,
  - `Workbench.vue` owns preview typography overrides,
  - `ComponentPickerDialog.vue` owns responsive preview scaling,
  - `useComponentRegistry.ts` merges shared and project-local definitions,
  - `locales-meta.ts` centralizes inline SVG flags.

## Current source state
- `useContentLiveUpdates.ts` now preserves native interaction for interactive controls while still emitting inline-preview focus metadata, which is important for accordion/toggle components.
- `Workbench.vue` explicitly applies `fontFamily: "var(--font-sans)"` to make sans preview overrides visible immediately.
- `useContentPropId.ts` provides the expected app-facing contract for `data-prop-id` markers.
- `useComponentRegistry.ts` still follows the intended architecture:
  - shared primitive definitions in-layer,
  - project definitions merged from `~/content-builder/component-definitions`.
- No tracked local diffs were present under `layers/content` during this analysis.

## Validation
- Ran content-layer suite from the correct layer working directory:
  - `./node_modules/.bin/vitest --config vitest.config.ts content/tests/**/*.spec.ts --run`
- Result:
  - test discovery worked,
  - all suites failed early because the CouchDB-backed harness could not connect to `127.0.0.1:5984` / `::1:5984`,
  - failures are environmental (`EPERM` / local connection blocked), not feature assertions.
- This means the layer has meaningful automated coverage, but full validation requires an accessible local CouchDB instance.

## Risks and implementation guidance
- Highest-regression files remain:
  - `app/components/admin/ContentAdminWorkbench.vue`,
  - `app/composables/useContentLiveUpdates.ts`,
  - `app/components/builder/Workbench.vue`,
  - `app/components/builder/ComponentPickerDialog.vue`.
- Safe extension strategy:
  - keep changes additive,
  - prefer small focused subcomponents/composables over growing orchestration files,
  - preserve the existing inline preview contract (`data-prop-id` -> postMessage -> node editor focus).
- For Bitvocation-facing work, the layer is ready for more component migrations as long as registry generation and prop-focus mapping stay in sync.

# Next Steps
1. Before any content-layer change that uses DB-backed tests, ensure local CouchDB on port `5984` is reachable from the current environment.
2. For app-facing component work, keep using the established contract:
  - prop-driven schemas,
  - `builderFieldMeta` for discrete options,
  - `useContentPropId()` on rendered editable output.
3. If the next feature touches preview UX, isolate it to the smallest possible seam in `Workbench.vue`, `ComponentPickerDialog.vue`, or `useContentLiveUpdates.ts` and verify it against interactive controls and nested array props.
