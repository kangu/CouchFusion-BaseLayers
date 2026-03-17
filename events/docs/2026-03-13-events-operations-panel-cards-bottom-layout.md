# Events Operations Panel Cards Bottom Layout

## Scope
Adjusted the top "Events Operations" panel on `/admin/events/conferences` so KPI cards align at the bottom and stay on a single row at large breakpoints.

## Changes
- Switched the hero panel container to vertical flex layout with large-screen bottom alignment:
  - `lg:min-h-[300px]`
  - `lg:justify-between`
- Updated cards container to become one horizontal row on large screens:
  - `lg:grid-cols-5`
  - `lg:mt-auto`
- Kept responsive behavior for smaller screens with stacked/two-column card flow.

## File
- `layers/events/app/pages/admin/events/conferences.vue`
