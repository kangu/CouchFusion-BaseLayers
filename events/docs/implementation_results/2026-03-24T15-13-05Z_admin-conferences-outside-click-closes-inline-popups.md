# Admin Conferences Outside-Click Popup Close

## Scope
Updated the admin conferences page so inline popups close when users click outside them.

## Changes
- Added a document-level `pointerdown` listener (capture phase) to detect outside clicks and close open popup state.
- Added lifecycle cleanup for the listener on unmount.
- Added popup/toggle data attributes used by outside-click detection:
  - `data-inline-status-toggle`
  - `data-inline-status-menu`
  - `data-publish-confirm-toggle`
  - `data-publish-confirm-menu`

## Files
- `layers/events/app/pages/admin/events/conferences.vue`

## Behavior
- Open status dropdown closes when clicking anywhere outside the dropdown or its trigger.
- Open publish/unpublish confirmation closes when clicking anywhere outside the confirmation popup or its trigger.
- Existing popup actions (select status, cancel, unpublish) continue to work.

## Verification
- `cd apps/bitvocation && bun run build` (pass)
