# Events Admin CSV Intake Dialog

## Scope
Refactored the conferences admin page so CSV intake runs through a button-triggered dialog instead of a permanently expanded inline section.

## Changes
- Replaced inline CSV intake block with a compact entry section and `Open CSV Intake` button.
- Added modal dialog workflow for CSV operations:
  - upload file
  - paste CSV text
  - preview CSV
  - import conferences
  - import quality panel (row counts + warnings)
  - preview snapshot table
- Added guarded close behavior while preview/import requests are running.

## Files
- `layers/events/app/pages/admin/events/conferences.vue`
