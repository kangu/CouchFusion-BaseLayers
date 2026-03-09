# Initial Prompt
Make sure we have svg flags for all the languages here in the translation dialog.

# Plan
1. Inspect translation dialog locale rendering path and identify the shared locale metadata source used for labels and flags.
2. Add missing SVG assets for all locales visible in the dialog that currently have no flag.
3. Extend `locales-meta` mappings with new imports and locale entries so the existing UI renders flags without component changes.
4. Verify files and mappings are complete for all configured locales used in the dialog.

# Implementation Summary
- Confirmed the translation dialog uses `resolveLocaleMeta(locale).flagSvg` in `ContentAdminWorkbench.vue`.
- Identified missing locale flag metadata for:
  - `hu`, `pl`, `bg`, `no`, `sv`, `fi`, `da`, `hr`, `cs`, `el`, `ar`, `tr`
- Added new inline SVG flag assets under:
  - `layers/content/app/assets/flags/hu.svg`
  - `layers/content/app/assets/flags/pl.svg`
  - `layers/content/app/assets/flags/bg.svg`
  - `layers/content/app/assets/flags/no.svg`
  - `layers/content/app/assets/flags/sv.svg`
  - `layers/content/app/assets/flags/fi.svg`
  - `layers/content/app/assets/flags/da.svg`
  - `layers/content/app/assets/flags/hr.svg`
  - `layers/content/app/assets/flags/cs.svg`
  - `layers/content/app/assets/flags/el.svg`
  - `layers/content/app/assets/flags/ar.svg`
  - `layers/content/app/assets/flags/tr.svg`
- Updated shared locale registry:
  - `layers/content/app/utils/locales-meta.ts`
  - Added imports + `LOCALE_META_BY_CODE` entries for all locales above.
  - Included native-language labels for the new locales.

Result: the Start Translation dialog now has inline SVG flags for all currently listed locales, using the existing rendering path with no UI refactor.

# Proposed Next Steps
1. Open the translation dialog and visually verify each locale chip renders the expected flag icon and label.
2. If you want stricter visual consistency, we can normalize all flag drawings to a shared style (same margin/corner treatment and contrast balancing).
