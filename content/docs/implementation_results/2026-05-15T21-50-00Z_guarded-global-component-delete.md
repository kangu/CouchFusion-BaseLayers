# Guarded Global Component Delete

## Initial Prompt

Provide a way to delete global components only when no page instances use them. If instances exist, throw an error and show which pages contain the global component.

## Implementation Summary

- Added a guarded admin delete endpoint:
  - `DELETE /api/content/global-components/admin?id=<aliasId>`
  - Requires `requireAdminSession`.
  - Returns `409` with `{ aliasId, pages }` when any current page document contains the alias.
- Added `server/utils/global-component-usage.ts`.
  - Scans current `page-*` documents.
  - Recursively checks minimark body arrays for the alias component tag.
  - Returns page `id`, `path`, and `title` for blocked deletes.
- Hardened existing full settings saves.
  - `PUT /api/content/global-components/admin` now rejects accidental alias removal if the removed alias is still used on pages.
- Added `deleteAdmin(id)` to `useGlobalComponentsRegistry`.
- Added a delete button on global component cards in the Select Component dialog.
  - On blocked deletes, the builder alert lists the pages returned by the API.

## Verification

- `./node_modules/.bin/vitest --config vitest.config.ts content/tests/api-global-components.spec.ts content/tests/builder/component-picker-dialog-categories.spec.ts --run`
- `./node_modules/.bin/vitest --config vitest.config.ts content/tests/**/*.spec.ts --run`

Full content suite passed: 19 files, 83 tests.
