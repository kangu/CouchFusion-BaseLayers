# Admin Conferences: Discount Code Column Sorting

## Summary
Enabled sorting on the `Discount Code` column in `/admin/events/conferences` table.

## Changes
- Updated `layers/events/app/pages/admin/events/conferences.vue`:
  - Added `"discountCode"` to `ConferencesSortKey`.
  - Added sort branch in `sortedConferences` comparator for `discountCode`.
  - Converted `Discount Code` table header into a sortable button using `toggleSort('discountCode')` and `sortIndicator('discountCode')`.

## Verification
- `./layers/node_modules/.bin/vitest --config layers/bitvocation-content.vitest.config.ts apps/bitvocation/tests/**/*.spec.ts --run`
- Result: `8` files passed, `23` tests passed.
