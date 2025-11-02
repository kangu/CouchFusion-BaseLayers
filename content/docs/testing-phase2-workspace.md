# Testing Plan – Vitest Workspace Relocation

## Initial Prompt
```
The vitest.workspace.ts sits outside the layers folder, include it inside layers and make that the root directory from which tests will be executed
```

## Implementation Summary
Implementation Summary: Moved the Vitest config into the `layers/` directory (`vitest.config.ts`) and updated documentation to reflect the new test entry point.

## Documentation Overview
- Relocated the configuration to `layers/vitest.config.ts`, keeping the content project wired to `../_tests/setup/content.ts`.
- Refreshed references in `docs/testing/couchdb-test-harness.md` and `layers/content/docs/specs/testing_plan.md` so contributors know the workspace file now lives alongside layers.
- Adjusted the Phase 2 harness log to reference the new workspace path.

## Implementation Examples
- `layers/vitest.config.ts:1` — Vitest configuration anchored inside the `layers` directory.
- `docs/testing/couchdb-test-harness.md:6` — Updated documentation pointing at the relocated workspace file.
