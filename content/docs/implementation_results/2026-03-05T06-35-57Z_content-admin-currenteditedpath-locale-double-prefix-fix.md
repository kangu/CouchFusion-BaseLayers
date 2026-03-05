# Content Admin `currentEditedPath` Locale Prefix Fix

Date: 2026-03-05

## Request
- Fix display issue in `ContentAdminWorkbench.vue` where locale paths appeared duplicated (`/fr/fr`, `/fr/fr/page-title`).

## Implementation
- Updated `currentEditedPath` computation to:
  - resolve any incoming path to canonical base path via `resolveContentLocalePath`
  - render locale-prefixed path via `buildLocalizedPath`
- This prevents double-prefixing when the selected summary already has localized path.

## File Updated
- `content/app/components/admin/ContentAdminWorkbench.vue`

## Validation
- `bun run build` in `apps/radustanciu` passed (SSR/client build successful).
