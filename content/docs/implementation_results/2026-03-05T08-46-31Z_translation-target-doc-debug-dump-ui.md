# Translation Target Doc Debug Dump UI

## Request
Investigate how the target localized document body is constructed for LLM translation persistence and expose an interface-level debug dump so intermediary values can be verified before and after persist.

## What was added
- Added per-locale translation debug state in the admin workbench to capture:
  - staged minimal document (`body.value`) produced by translation staging
  - persist request document sent via `saveDocument`
  - persist response document returned after save
- Added a collapsible `Debug target doc body` panel to each locale card in the Translation report dialog.
- The panel prints a JSON dump with:
  - locale + source locale + overwrite mode
  - report counters (`translatedCount`, `appliedCount`, `skippedCount`)
  - returned key/value translations
  - staged target doc dump (id/path/contentI18n/bodyValue)
  - persist request dump (id/path/contentI18n/bodyValue)
  - persist response dump (id/path/contentI18n/bodyValue)

## Files changed
- `layers/content/app/components/admin/ContentAdminWorkbench.vue`
  - added debug state and helpers (`mergeTranslationLocaleDebug`, `getTranslationLocaleDebugDump`)
  - wired debug snapshots into staged-translation apply and persist flow
  - rendered debug dump in translation modal locale cards
  - added scoped styles for the new debug panel

## Verification
- `bun run build` in `apps/radustanciu` completed successfully.

## Notes
- This is UI-only introspection and does not alter server translation or persistence behavior.
- The dump explicitly shows `body.value` to validate minimark-compatible payload content.
