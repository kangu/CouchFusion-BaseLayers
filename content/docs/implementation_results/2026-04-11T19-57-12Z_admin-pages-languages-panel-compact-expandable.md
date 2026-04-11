# Initial Prompt
Make the languages panel into a compact form with an expanded state when interacting with it

# Plan
1. Keep all phase 1/2 language management behavior intact.
2. Refactor language panel UI to default compact mode.
3. Add explicit expand/collapse control and auto-expand on interaction (focus/error).
4. Keep notices/errors readable with minimal clutter in collapsed state.
5. Validate with `nuxi prepare`.

# Implementation Summary
- Updated `layers/content/app/pages/admin/pages.vue`:
  - Added `isI18nPanelExpanded` state.
  - Added compact summary computed label (`i18nCompactSummary`).
  - Added panel toggle button (`Manage` / `Collapse`).
  - Default state now shows only compact summary + high-level effective/default hint.
  - Full phase 1/2 controls render only when expanded.
  - Panel auto-expands on focus interaction (`@focusin`).
  - Error paths (load/save/migrate failures) force expanded state so users see/fix issues quickly.
  - Notices are shown in expanded state; errors remain visible to avoid hidden failure states.
- Added/adjusted styling for compact header + summary and toggle alignment.

Validation performed:
- Ran `npx nuxi prepare` in `apps/nuxt-app-starter` successfully.

# Next Steps
1. Optionally persist panel expanded/collapsed preference in localStorage.
2. Optionally auto-collapse after successful save/migration if no errors are present.
