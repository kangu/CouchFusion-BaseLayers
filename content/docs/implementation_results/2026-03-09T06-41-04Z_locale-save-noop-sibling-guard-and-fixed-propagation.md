# Locale Save No-op Sibling Guard + Fixed Field Propagation

Date: 2026-03-09

## Request
- When saving a localized page, do not persist other locale documents if there is no actual content/path change.
- Keep default/master doc untouched on locale-only edits.
- Ensure fixed/global fields (`fixedBodyPaths` in `body.value`) saved from a locale still propagate to the default/master document.

## Changes Implemented
- Updated localized save flow in:
  - `layers/content/server/utils/content-pages-save.ts`

### 1) Stop metadata-only sibling writes
- In both propagation loops (default save branch and non-default save branch), sibling locale docs are now persisted only when:
  - localized `body` changed after fixed-path application, or
  - localized `path` needed normalization.
- If neither changed, the loop skips persistence entirely (no metadata-only `updatedAtByLocale` sync writes).

### 2) Keep master untouched on locale-only edits
- In non-default locale saves, master doc persistence now depends only on master `body` change (driven by fixed-path updates).
- Removed metadata-initialization-only master persistence path for locale-only saves.

### 3) Preserve fixed/global propagation behavior
- Fixed/global path changes from locale saves (`fixedBodyPaths`) still write through to master body.
- When those fixed values change, sibling locales are updated only if the propagated fixed values actually change their body.

## Automated Tests Added
- New spec:
  - `layers/content/tests/content-pages-save-i18n.spec.ts`

### Coverage
1. `does not persist untouched sibling locales or master on locale-only changes`
- Verifies FR locale save with only localized-field change updates FR only.
- Verifies master and RO docs keep same revision.

2. `propagates fixedBodyPaths changes from locale save to master and other locales`
- Verifies fixed/global field change in FR updates master and RO.
- Verifies non-fixed localized text does not overwrite master localized fields.

## Validation
Executed:
- `bunx vitest --config vitest.config.ts content/tests/content-pages-save-i18n.spec.ts --run`
- `bunx vitest --config vitest.config.ts content/tests/api-content-pages.spec.ts --run`

Result: all tests passed.
