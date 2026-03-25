# Admin Conferences Table: City Column Inline Edit

## Request
Refactor the admin table location slot to show only City and allow in-place editing by clicking it.

## Changes
- Changed location-column header label from `City, Country` to `City`.
- Replaced static city/country text in that column with inline-edit behavior for `city`:
  - click value to edit,
  - blur/enter to save,
  - escape to cancel,
  - inline saving/error states.
- Updated inline-edit field model from `location` to `city`.
- Updated sort behavior for the same column key (`location`) to sort by `city` value.

## File
- `/Users/radu/Projects/nuxt-apps/layers/events/app/pages/admin/events/conferences.vue`
