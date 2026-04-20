# Component picker UX: default Sections tab, Basic HTML grouping, primitive previews

## Request
Implement:
1. Open picker on `Default`-equivalent tab first (sections-focused).
2. Reclassify primitive components into a dedicated tab.
3. Replace empty primitive previews with meaningful visual placeholders.

## Changes
Updated `layers/content/app/components/builder/ComponentPickerDialog.vue`:

- Default tab behavior:
  - `selectedCategory` now defaults to `default` instead of `all`.
  - close/reset/open flows now return to `default`.
  - category safety watch keeps selection valid if tab set changes.

- Category model:
  - Added primitive detection for ids/labels: `p`, `span`, `strong`, `template`.
  - Primitive components are normalized into `basic-html` category.
  - Tab label mapping updated:
    - `default` -> `Sections`
    - `basic-html` -> `Basic HTML`
  - Tab ordering prioritized as:
    - `All`, `Sections`, `Global`, `Basic HTML`, then remaining categories.

- Primitive previews:
  - Primitive cards no longer render empty iframe previews.
  - Added static preview UI variants:
    - paragraph lines
    - span inline tokens
    - strong emphasis tokens
    - template slot placeholder
  - Non-primitive components keep existing iframe preview path unchanged.

## Verification
- `cd apps/nuxt-app-starter && bunx nuxi prepare` passed.

## Files
- `layers/content/app/components/builder/ComponentPickerDialog.vue`
