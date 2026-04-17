# Global Alias Props Initialization Fix in Builder

## Issue
Global component save/persistence worked, but when opening a page for editing, alias component props were not initialized from the global defaults, so fields appeared uninitialized.

## Root cause
Builder tree deserialization only used page-local node props. For global alias nodes that are persisted as references (without local props), the editor had no explicit hydration step from global registry defaults.

## Fix
In `Workbench.vue`:
- Added `globalAliasDefaultsById` computed map from global registry entries.
- Added `hydrateGlobalAliasProps()` tree pass that injects missing alias props from global defaults into local editor node state.
- Hydration only fills missing non-internal keys and does not overwrite existing local values.
- Runs after `fetchPublic()` on mount and also on registry changes.

## Result
- Global alias props are initialized in the page editor as expected.
- Editing experience remains similar to regular components.
- Persistence remains reference-only for page docs and centralized for global defaults.

## Validation
- `apps/nuxt-app-starter`: `npx nuxi prepare` passed.

## Files changed
- `layers/content/app/components/builder/Workbench.vue`
