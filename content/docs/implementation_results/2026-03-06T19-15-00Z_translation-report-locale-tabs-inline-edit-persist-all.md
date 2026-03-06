# Translation report locale tabs, inline editing, and persist-all

## Summary
Updated the translation report dialog in the content admin workbench to:
- show one tab per result locale,
- show persistence state near each locale code,
- allow inline editing of translated values before persistence,
- persist one locale at a time or persist all locales in one action.

## File changed
- `layers/content/app/components/admin/ContentAdminWorkbench.vue`

## Behavior changes
1. Locale tabs
- Locale results are now navigated with tabs at the top of the report.
- Every locale returned by the translation run appears as a tab.
- Active tab controls the locale detail card shown below.

2. Persist status by locale
- Each locale tab now displays status:
  - `not persisted`
  - `persisting`
  - `persisted`
  - `failed` (for translation errors)
- Locale detail header also shows translation count + persistence status.

3. Persist actions
- Added `Persist all` button for all eligible locales (status `ok`, staged, not already persisted).
- Existing single-locale persist remains available in active locale panel.
- `Open <locale>` remains available after that locale is persisted.

4. Inline edit before persist
- Translation values are now editable inline (textarea per translation key).
- Edits are tracked per locale and immediately applied to staged target document body by pointer.
- Persist operations apply all current draft edits before saving the locale document.

## Technical notes
- Added local draft state map:
  - `translationDraftValuesByLocale`
- Added active tab state:
  - `selectedTranslationResultLocale`
- Added bulk persist pending state:
  - `isPersistAllTranslationsPending`
- Added pointer helpers to safely update staged `body.value`:
  - pointer parse/decode
  - pointer traversal + write to existing path
- Added bulk persistence method:
  - `persistAllTranslatedLocales()` (sequential persist)

## Validation
- Translation report now renders with locale tabs and a single active locale panel.
- Editing translation text updates staged locale content before persistence.
- `Persist all` persists each eligible locale sequentially.
- Persistence badges update per locale after save.

No automated verification was completed in this step due missing local test environment dependencies (`_tests/setup/content.ts`, `jsdom`) in this workspace.
