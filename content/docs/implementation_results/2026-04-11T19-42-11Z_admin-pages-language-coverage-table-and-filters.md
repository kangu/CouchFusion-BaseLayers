# Initial Prompt
Let's implement this functionality. Make sure to cater for the case when there is only a language available in the system.

# Plan
1. Extend content pages index API to return locale coverage metadata per master page row.
2. Extend content page localization typings to include locale coverage fields.
3. Update `/admin/pages` table filtering and rendering to use locale coverage model (master row + locale health), including a graceful single-language mode.
4. Validate with `nuxi prepare`.

# Implementation Summary
- Updated `layers/content/server/api/content/pages.get.ts` list (`GET /api/content/pages` without `path`):
  - Switched from default-locale-only filtering loop to base-path grouping with per-locale document aggregation.
  - Added locale coverage metadata in response localization object:
    - `availableLocales`
    - `missingLocales`
    - accurate `missingLocalizedCount`
  - Preserved one-row-per-master-page behavior and sorting by path.
- Updated `layers/content/types/content-page.ts`:
  - extended `ContentPageLocalizationSummary` with optional `availableLocales` and `missingLocales`.
- Updated `layers/content/app/pages/admin/pages.vue`:
  - Added runtime-aware locale config consumption (`resolveContentI18nConfig`).
  - Added locale-aware filter controls:
    - global localization status
    - specific locale selector
    - locale presence mode (`Any`, `Has Locale`, `Missing Locale`)
  - Added locale health rendering per row:
    - coverage badge (`available/configured`)
    - missing count badge
    - per-locale status chips
  - Added single-language behavior:
    - locale-specific filters hidden automatically when only one locale is configured
    - row shows `Single language setup` note instead of per-locale chip grid.

Validation performed:
- Ran `npx nuxi prepare` in `apps/nuxt-app-starter` successfully.

# Next Steps
1. Restart the active dev process if route graph/cache is stale before visual verification.
2. Optionally add an expandable locale details panel per row for locale-specific timestamps/actions.
3. Optionally persist locale filters in query params for shareable review links.
