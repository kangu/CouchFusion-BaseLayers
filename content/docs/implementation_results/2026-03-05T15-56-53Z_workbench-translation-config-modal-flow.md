# Initial Prompt
Update the translation UI on the content workbench. Instead of having a panel between the buttons, make it so that whenever a translate action is initiated, there is a dialogue popping up asking for destination translations, overwrite mode, and a confirmation to proceed. Use that selection to start the translation progress and proceed with the workflow as it is now. content/app/components/admin/ContentAdminWorkbench.vue line 1977

# Plan
1. Remove inline translation controls from the editor header and keep a single translate trigger button.
2. Add a translation configuration modal to collect destination locales + overwrite mode + explicit confirmation.
3. Route all translation entry points through the new config modal (page-level and scoped translation triggers).
4. Keep existing progress/report modal and persistence workflow unchanged after confirmation.
5. Ensure dialog state resets on page/context switches.

# Implementation Summary
- Updated `layers/content/app/components/admin/ContentAdminWorkbench.vue`.
- Replaced inline translation controls in header with a single `Translate` button.
- Added new translation config dialog state:
  - `isTranslationConfigDialogOpen`
  - `pendingTranslationPayload`
  - `translationConfigError`
  - `translationConfigModalSubtitle` (computed)
- Added new flow helpers:
  - `openTranslationConfigDialog(payload)`
  - `closeTranslationConfigDialog()`
  - `confirmTranslationConfigAndRun()`
- Changed translation trigger routing:
  - `handleTranslateScope(...)` now opens the config dialog first.
  - After confirmation, existing `runScopedTranslation(...)` executes unchanged and opens the current progress/report modal.
- Added translation config modal UI (Teleport + modal panel) with:
  - destination locale checkboxes
  - overwrite mode selector
  - cancel + start translation actions
- Added scoped styles for config modal controls:
  - `translation-config__content`
  - `translation-config__field`
  - `translation-config__label`
  - `translation-config__targets`
  - `translation-config__select`
- Added reset handling for new dialog state when switching/deleting pages to avoid stale modal payloads.

# Next Steps
1. Validate end-to-end in Workbench:
   - Page Translate button
   - Field/Section translate actions
   - Confirm both now prompt configuration first.
2. Verify progress/report modal content and staged locale persistence remain identical to previous behavior after confirmation.
3. Optionally prefill target locales differently (currently defaults to all non-active locales only when none selected).
