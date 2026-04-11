# Admin Pages: Create/Clone Modal Styling Aligned with Builder

## Scope
- Layer: `layers/content`
- Feature area: `/admin/pages` dialog UI for Create New Page and Clone Page

## Problem
- The Create/Clone dialogs in `app/pages/admin/pages.vue` were using table-form field classes (`pages-field`) and a separate modal style system (`pages-modal*`), resulting in broken visual layout.
- The expected appearance was the same modal presentation pattern used by `ContentAdminWorkbench` (Builder instantiation).

## Changes Implemented
- Refactored both dialogs in `layers/content/app/pages/admin/pages.vue` to use the Builder modal structure:
  - `content-admin-pages__modal`
  - `modal__backdrop`
  - `modal__panel`
  - `modal__header`, `modal__title`, `modal__subtitle`, `modal__close`
  - `modal__form`, `modal__field`, `modal__field-grid`, `modal__actions`, `modal__error`
- Replaced legacy `pages-modal*` CSS with Builder-aligned modal styling (spacing, typography, inputs, focus states, shadow, layout).
- Kept business behavior unchanged:
  - Existing create/clone handlers
  - Existing pending/disable states
  - Same open/close flow and validation/error paths

## Verification
- Ran in starter app:
  - `cd apps/nuxt-app-starter && npx nuxi prepare`
- Result: success (`[nuxi] ✔ Types generated in .nuxt`)

## Runtime Impact
- Minimal.
- UI-only refactor in scoped CSS + template class structure; no API or store contract changes.
