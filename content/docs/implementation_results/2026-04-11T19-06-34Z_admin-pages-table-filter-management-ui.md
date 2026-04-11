# Initial Prompt
Inside /admin/pages I don't want to have the inline editor available but rather a table-like structure of the pages in the system, with full filtering to allow for easy managing large numbers of pages.

# Plan
1. Replace the `/admin/pages` content-layer page implementation so it no longer mounts the inline workbench/editor.
2. Build a table-based listing UI backed by `useContentPagesStore().fetchIndex()`.
3. Add high-signal filtering/sorting controls suitable for large datasets.
4. Add operational row actions (open in builder, view live page, delete).
5. Validate type generation and note any local runtime constraints.

# Implementation Summary
- Reworked `layers/content/app/pages/admin/pages.vue` from workbench-based layout to a dedicated table management screen.
- Removed `ContentAdminWorkbench` usage entirely from `/admin/pages`.
- Added filters:
  - free-text search across path/title/SEO title/SEO description
  - localization status (`all`, `needs-localization`, `localized`)
  - SEO image status (`all`, `with-image`, `without-image`)
- Added sort controls:
  - field (`updated`, `path`, `title`)
  - direction (`asc`, `desc`)
- Added pagination controls with selectable page size (10/25/50/100).
- Added row actions:
  - `Open Builder` (navigates to `/builder...` path)
  - `View` (opens page in new tab)
  - `Delete` (confirm + per-row pending state)
- Added summary and error/loading states for faster operational feedback.

Validation performed:
- Ran `npx nuxi prepare` in `apps/nuxt-app-starter` successfully.

# Next Steps
1. Restart the running dev server if `/admin/pages` still serves stale route output from previous hot state.
2. Optionally add server-side pagination/filter API once page counts exceed client-side filtering comfort.
3. Optionally add bulk operations (multi-select delete, bulk locale/status ops).
