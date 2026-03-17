# Initial Prompt
On the /admin/events/conferences implement the same functionality for grouping Month Year labels into color-coded pill values. Make sure to update the Year column to show "[Month] [Year]"

# Plan
1. Add month-year key/label helpers in the admin conferences page.
2. Add deterministic color mapping for month-year keys.
3. Replace Year cell content with a month-year pill.
4. Keep sorting/API/query behavior unchanged.

# Implementation Summary
- Updated `layers/events/app/pages/admin/events/conferences.vue` to render month-year pills in the existing Year column.
- Added helper logic:
  - `conferenceMonthKey(conference)` for normalized `YYYY-MM` grouping,
  - `conferenceMonthLabel(conference)` for display labels like `Aug 2026`,
  - `conferenceMonthPillClass(conference)` for deterministic palette-based styling.
- Applied neutral fallback pill (`TBA`) when date is missing/invalid.
- No API changes; no change to filtering or existing sort controls.

# Next Steps
1. Reload `/admin/events/conferences` and verify same month-year entries share the same pill color.
2. If needed, we can add dedicated month-year sorting in a follow-up.
