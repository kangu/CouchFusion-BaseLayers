# NodeArrayItem remove confirmations

## Summary
Added confirmation dialogs for all `Remove item` actions in the node array editor so removals require explicit user confirmation.

## Changes
- Updated `layers/content/app/components/builder/node-editor/NodeArrayItem.vue`.
- Replaced direct removal handlers in template with confirmation wrappers for:
  - top-level jsonarray item removal
  - top-level stringarray item removal
  - nested stringarray item removal inside jsonarray items
  - nested jsonarray item removal
  - nested stringarray item removal inside nested jsonarray items
- Added local helpers in `<script setup>`:
  - `shouldConfirmRemoval()` using `window.confirm("Remove this item? This action cannot be undone.")`
  - wrapper methods (`confirmRemove*`) that call original prop handlers only when confirmed.

## Result
All `Remove item` actions in `NodeArrayItem.vue` now show a confirmation prompt before deleting data.
