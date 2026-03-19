# Email Template MJML Editor: Collapsed Default + Hidden Error Panel

## Request
Refactor the new CodeJar MJML editor so it is collapsed by default and shown only after clicking a toggle. Hide the MJML compile error element.

## Changes
- Updated `layers/email/app/pages/admin/email-templates/[id].vue`:
  - Added `isMjmlEditorExpanded` state (default `false`).
  - Added `toggleMjmlEditor()` handler.
  - Added a toggle button in the MJML section:
    - `Show MJML Editor` when collapsed
    - `Hide MJML Editor` when expanded
  - Rendered the editor only when expanded (`v-if="isMjmlEditorExpanded"`).
  - Removed the visible amber MJML error panel from the UI.
  - Simplified helper text to:
    - `Compiling MJML…` while compiling
    - `MJML will recompile automatically.` otherwise

## Verification
- Playwright check on `/admin/email-templates/welcome_to_pow_lab` confirms:
  - toggle is visible,
  - initial state is collapsed,
  - editor is hidden by default,
  - MJML error panel element is no longer rendered.
