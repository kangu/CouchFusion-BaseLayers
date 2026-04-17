# Initial Prompt
Fix focus loss in Global Components admin table when typing in Alias field.

# Plan
1. Inspect row rendering key for global component drafts.
2. Ensure each draft row has a stable key not derived from editable user input.
3. Validate build/types.

# Implementation Summary
- Root cause: row `v-for` key used editable alias text (`entry.id`), causing row remount on each keystroke and input blur.
- Fix in `layers/content/app/pages/admin/pages.vue`:
  - Added stable per-row `draftKey` in `GlobalComponentDraft`.
  - Added monotonic key generator (`nextGlobalComponentDraftKey`).
  - Assigned stable keys when syncing existing entries and adding new entries.
  - Updated template key to `:key="entry.draftKey"`.

# Validation
- `cd apps/nuxt-app-starter && npx nuxi prepare` passed.

# Next Steps
1. Reopen `/admin/pages` and verify alias input keeps focus while typing.
2. Optionally add drag-and-drop reordering later (stable keys already support it cleanly).
