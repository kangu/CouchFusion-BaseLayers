# Content Layer Internationalization Implementation (Master + Locale Docs)

Date: 2026-03-04

## Scope Implemented
- Implemented SSR-safe locale-aware content fetching/saving with one CouchDB document per locale page.
- Linked locale documents to a master document through `meta.contentI18n`.
- Kept all i18n metadata outside minimark (`body.value` unchanged as minimark-compatible content).
- Implemented same-request propagation of fixed fields from master to locale docs and non-master write-through for fixed edits.
- Added per-locale timestamp tracking (`updatedAtByLocale`).
- Added locale switcher + missing localized values indicator in the admin workbench.

## Key Technical Changes
- Added server i18n utilities:
  - `content/server/utils/content-i18n.ts`
  - `content/server/utils/content-pages-save.ts`
- Switched page save APIs to shared localized save pipeline:
  - `content/server/api/content/pages.post.ts`
  - `content/server/api/content/pages.put.ts`
- Updated page read API for locale-aware read + fallback merge:
  - `content/server/api/content/pages.get.ts`
- Updated delete API to remove all locale docs for a page group:
  - `content/server/api/content/pages.delete.ts`
- Added locale-aware history fetching and locale keying:
  - `content/server/api/content/pages/history.get.ts`
  - `content/server/utils/page-history.ts`
  - `content/utils/design-documents.ts`
- Added fixed-path extraction from minimark body using component schema/localized metadata:
  - `content/utils/i18n-body.ts`
  - integrated in `content/app/components/builder/Workbench.vue`
- Updated store + middleware for locale-aware SSR fetch/save/history:
  - `content/app/stores/pages.ts`
  - `content/app/middleware/content.global.ts`
- Updated admin workbench UX:
  - locale selector
  - per-locale save/load/history behavior
  - missing localized value indicator
  - file: `content/app/components/admin/ContentAdminWorkbench.vue`

## Data Model Notes
- `meta.contentI18n` now carries:
  - `masterId`
  - `locale`
  - `defaultLocale`
  - `fixedBodyPaths`
  - `updatedAtByLocale`
- Plain minimark text nodes are treated as localizable by default.
- Fixed/localizable detection for component props uses schema `localized` markers.

## Validation
- Attempted automated validation:
  - `bunx vitest --config layers/vitest.config.ts`
- Result:
  - Blocked by environment issues (`Cannot find module _tests/setup/content.ts`, missing `jsdom`), so full suite could not execute in this environment.

## Follow-up Fixes (2026-03-04)
- Adjusted history retention to prune per `path + locale` (not globally per path) in `content/server/utils/page-history.ts`.
- Fixed save response translation status to compute `missingLocalizedCount` from the raw locale document body (not the merged fallback body) in `content/server/utils/content-pages-save.ts`.
- Normalized save response `hasLocaleDocument` to only be `true` for non-default locales when a locale doc exists.
- Updated non-default locale persistence/read flow so locale documents use localized `path` values (e.g. `/fr`) while still resolving by canonical base path linkage in:
  - `content/server/utils/content-pages-save.ts`
  - `content/server/api/content/pages.get.ts`
  - `content/server/utils/content-i18n.ts`
  - `content/server/utils/page-history.ts`
  - `content/utils/design-documents.ts`
