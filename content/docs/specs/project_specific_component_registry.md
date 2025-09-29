# Project-Specific Component Registry

## 1. Extract Shared Defaults
_Status (2025-09-26): ✅ Completed_

- The content layer now keeps the generic builder components (`p`, `span`, `template`) inside
  `app/composables/useComponentRegistry.ts` as the `defaultDefinitions` list.

## 2. Merge Project Definitions
_Status (2025-09-26): ✅ Completed_

- `useComponentRegistry` resolves extra definitions from `~/content-builder/component-definitions`
  (supporting `default`, `definitions`, or `getDefinitions()` exports) and merges them with the
  defaults, letting project entries override by `id`.

## 3. Bitvocation Demo Registry
_Status (2025-09-26): ✅ Completed_

- `apps/bitvocation-demo/content-builder/component-definitions.ts` now exports the project-specific
  components (e.g., `hero-section`, `you-tube-embed`), demonstrating how definitions are layered on
  top of the shared defaults.
