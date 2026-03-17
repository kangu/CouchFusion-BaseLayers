# Events Admin Conferences Table Layout

## Scope
Updated `/admin/events/conferences` in the events layer for higher-density operations when many conferences are present.

## UX Changes
- Removed cards mode.
- Kept a single table-first layout for scale.
- Added compact icon-only edit action in each row.

## Sorting
Table sorting supports toggling ascending/descending on:
- Conference name
- Start date
- Year
- Location
- Country
- Status
- Published
- Confirmed

Sorting state is visible above the table and updates on each header click.

## Files
- `layers/events/app/pages/admin/events/conferences.vue`
