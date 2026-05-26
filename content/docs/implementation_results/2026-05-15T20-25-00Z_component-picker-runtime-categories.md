# Initial Prompt
Implement admin-managed, project-global runtime categories for the Select Component dialog.

# Implementation Summary
- Added normalized component picker category settings:
  - document id: `content-settings:component-picker-categories`
  - type: `content-component-picker-categories`
  - categories: ordered `{ id, label, order }`
  - assignments: `Record<componentId, categoryIds[]>`
- Added admin-only settings APIs:
  - `GET /api/content/component-picker-categories/admin`
  - `PUT /api/content/component-picker-categories/admin`
- Added conflict handling for stale `_rev` saves with HTTP `409`.
- Added shared category resolver behavior:
  - `All`, `Sections`, `Global`, and `Basic HTML` remain system tabs.
  - Custom categories appear after system tabs in configured order.
  - Unassigned components keep their generated fallback category.
  - Assigned components use admin assignments and can appear in multiple custom categories.
- Added `useComponentPickerCategories()` for picker-side loading/saving.
- Added admin-only Manage Categories mode inside `ComponentPickerDialog.vue`:
  - draft editing,
  - add/delete categories,
  - category label editing,
  - searchable component checkbox assignment,
  - explicit Save/Cancel.

# Verification
- First added failing tests for:
  - category tab/filter resolution,
  - admin API default/save/conflict/validation behavior,
  - picker manage-mode UI workflow.
- Ran targeted category tests:
  - `./node_modules/.bin/vitest --config vitest.config.ts content/tests/builder/component-picker-categories.spec.ts content/tests/api-component-picker-categories.spec.ts content/tests/builder/component-picker-dialog-categories.spec.ts --run`
  - Result: passed, `3` files and `9` tests.
- Ran builder regression tests after wiring the picker composable:
  - `./node_modules/.bin/vitest --config vitest.config.ts content/tests/builder/node-editor-search.spec.ts content/tests/builder/node-editor-highlight.spec.ts content/tests/builder/component-picker-dialog-categories.spec.ts --run`
  - Result: passed, `3` files and `7` tests.
- Ran the full content-layer test suite:
  - `./node_modules/.bin/vitest --config vitest.config.ts content/tests/**/*.spec.ts --run`
  - Result: passed, `16` files and `74` tests.

# Notes
- Scope stayed inside the `layers/content` layer.
- Existing `ComponentDefinition.category` and generated `builderComponentMeta.category` remain unchanged as fallback metadata.
- No codegen changes were required for v1.
