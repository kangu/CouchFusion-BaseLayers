# Testing Infrastructure Architecture Notes

## Initial Prompt
```
I want to setup the testing infrastructure so that it can modularily cover other layers like auth which itself depends much on the couchdb. There might be layers where the couchdb connection is not so relevant, and some for which it is. How do you recommend I setup the folders and test runner? Grouped as git repositories, I have all layers in a monorepo.
```

## Implementation Summary
Implementation Summary: Recommended a shared `tests/` workspace with reusable CouchDB bootstrap utilities, per-layer Vitest projects, and Playwright configuration that toggles CouchDB provisioning via metadata flags.

## Documentation Overview
- Updated `layers/content/docs/specs/testing_plan.md` with an “Infrastructure Architecture” section detailing folder layout, Vitest workspace configuration, Playwright project metadata, and environment isolation patterns.
- Captured the rationale for splitting shared utilities (`tests/utils`, `tests/fixtures`) from layer-specific setup entrypoints so other layers (e.g. auth) can hook into CouchDB or skip it as needed.
- Included guidance on scripting (`bun vitest --workspace layers`, project-scoped runs) to keep the workflow consistent across the monorepo.

## Implementation Examples
- `layers/content/docs/specs/testing_plan.md:9` — describes the recommended folder structure and test-runner wiring.
- Shared helpers should live under `tests/utils/couchdb.ts`, while layer-level setup files (e.g. `tests/setup/content.ts`) opt into the CouchDB bootstrap when required.
