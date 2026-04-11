# Initial Prompt
Add the functoinality to Create New Page and Clone page from the /admin/pages UI area. The functionality is already present in the builder

# Plan
1. Reuse existing content store APIs (`createPage`, `saveDocument`) in `/admin/pages`.
2. Add a table-toolbar `Create New Page` action with modal form.
3. Add per-row `Clone` action with modal form prefilled from selected page.
4. Keep behavior aligned with builder semantics (path/title required, metadata JSON parsing, default locale write path).
5. Validate with `nuxi prepare`.

# Implementation Summary
- Updated `layers/content/app/pages/admin/pages.vue`:
  - Added `Create New Page` button in toolbar.
  - Added `Clone` button in each row action set.
  - Added two modals:
    - Create modal (path/title/SEO/meta)
    - Clone modal prefilled from source page (path default suffix `-copy`, title/SEO/meta copied)
  - Implemented handlers:
    - `handleCreateNewPage()` -> `contentStore.createPage(..., { locale: defaultLocale })`
    - `handleClonePage()` -> duplicates source document and persists with `contentStore.saveDocument(..., { method: 'POST', locale: defaultLocale })`
  - Added shared helpers:
    - path normalization
    - duplicate path derivation
    - meta JSON parse/serialize
  - Added success/error notices in page summary/errors area.

Behavior notes:
- Create/Clone both enforce required `path` and `title`.
- Invalid meta JSON is surfaced as a validation error.
- Clone duplicates content/body from source page document and applies updated path/title/seo/meta.

Validation performed:
- Ran `npx nuxi prepare` in `apps/nuxt-app-starter` successfully.

# Next Steps
1. Optionally add component-level clone selection (like builder modal) if partial clone is desired from list view.
2. Optionally route to cloned page builder tab immediately after clone success.
