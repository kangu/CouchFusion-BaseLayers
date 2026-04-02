# Admin Conferences: Discount Code Empty-First ASC Sort

## Summary
Adjusted `Discount Code` sorting so conferences without a discount code appear first in ascending order.

## Changes
- Updated `layers/events/app/pages/admin/events/conferences.vue`:
  - Added `compareNullableTextEmptyFirst` comparator.
  - Wired `discountCode` sort branch to use empty-first behavior.

## Behavior
- `Discount Code` ASC: empty discount codes first, populated codes after.
- `Discount Code` DESC: populated codes first, empty discount codes last.

## Verification
- `./layers/node_modules/.bin/vitest --config layers/bitvocation-content.vitest.config.ts apps/bitvocation/tests/**/*.spec.ts --run`
- Result: `8` files passed, `23` tests passed.
