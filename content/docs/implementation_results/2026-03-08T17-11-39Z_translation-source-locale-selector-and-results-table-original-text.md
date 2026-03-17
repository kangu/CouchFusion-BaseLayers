# Initial Prompt
Update Start translation to allow starting from any locale (not necessarily current), with minimal impact. In final translation results, increase translation font size, include original text entry, and switch to a column-based table layout instead of stacked cards.

# Plan
1. Add a source-locale selector in the translation config modal and use it as the translation source.
2. Keep existing API contract for request shape and only change client flow for source document resolution.
3. Resolve source document by selected source locale with minimal side effects:
   - prefer staged source doc for that locale
   - fallback to current builder doc when source equals active locale
   - otherwise fetch source locale document from content store.
4. Keep translation targets logic intact, but derive destination options by excluding selected source locale.
5. Expand translation result entries with `original` text on the server response.
6. Replace translation rows UI with table columns: key, original, translation, and increase translation text size.

# Implementation Summary
- Updated translation source selection flow in:
  - `layers/content/app/components/admin/ContentAdminWorkbench.vue`
- Added `translationSourceLocale` state and source locale `<select>` in Start translation modal.
- Destination locale options now exclude selected source locale (not active locale).
- Added source locale validation before run (valid source + source not in destination locales).
- Added `resolveTranslationSourceDocument(...)`:
  - uses staged source locale doc when available
  - uses current builder doc if source locale is active locale
  - otherwise fetches source-locale page doc from store and converts it to minimal document.
- Translation run now sends selected `sourceLocale` and the resolved source document.
- Translation subtitles now display selected/actual source locale.

Server result enrichment:
- Updated `layers/content/server/api/content/llm-translations/translate.post.ts`
  - translation result entries now include `original` from source pointer map.

Client type update:
- Updated `layers/content/app/composables/useLlmTranslations.ts`
  - `translations[]` entries now support optional `original`.

Results dialog UI refactor:
- Updated `layers/content/app/components/admin/ContentAdminWorkbench.vue`
  - translation list replaced with a table layout (`Key`, `Original`, `Translation`).
  - translation textarea font size increased for better readability.
  - original text is displayed per row.

# Next Steps
1. Validate in UI with at least 3 locales: pick source locale different from active locale and run page + field scope translations.
2. Verify table scrolling behavior on narrow viewports and confirm `original` is present for each returned key.
3. Confirm persistence still works after inline edits in translation table cells.
