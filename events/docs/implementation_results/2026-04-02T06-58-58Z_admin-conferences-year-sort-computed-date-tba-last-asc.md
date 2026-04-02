# Admin Conferences: Year Sort by Computed Date (TBA Last in ASC)

## Summary
Updated `/admin/events/conferences` Year-column sorting to use computed conference dates from `startDateIso`, with TBA/empty dates placed at the end for ascending sort.

## Changes
- Added `layers/events/app/utils/conference-sort.ts`:
  - `compareConferenceYearByComputedDate(leftStartDateIso, rightStartDateIso, direction)`
  - supports both `YYYY-MM-DD` and full ISO datetimes
  - treats invalid/empty values as TBA
- Updated `layers/events/app/pages/admin/events/conferences.vue`:
  - Year sort branch now uses computed-date comparator
  - keeps numeric year comparator as tie-breaker when computed dates are equal
- Added `apps/bitvocation/tests/server/conference-sort.spec.ts`:
  - validates chronological ASC ordering
  - validates TBA values are at end in ASC

## Verification
- `./layers/node_modules/.bin/vitest --config layers/bitvocation-content.vitest.config.ts apps/bitvocation/tests/server/conference-sort.spec.ts --run`
- `./layers/node_modules/.bin/vitest --config layers/bitvocation-content.vitest.config.ts apps/bitvocation/tests/**/*.spec.ts --run`
- Result: `9` files passed, `25` tests passed.
