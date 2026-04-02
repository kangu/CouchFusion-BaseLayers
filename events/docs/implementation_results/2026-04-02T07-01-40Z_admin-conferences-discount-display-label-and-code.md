# Admin Conferences: Discount Column Label+Code Display Format

## Summary
Updated Discount Code cell rendering in `/admin/events/conferences` to display values in the requested format:

- `("discount_label") "discount_code"`

## Changes
- Updated `layers/events/app/pages/admin/events/conferences.vue`:
  - Added `formatConferenceDiscountDisplay(conference)` helper.
  - Discount column now renders:
    - both present: `("label") "code"`
    - only label: `("label")`
    - only code: `"code"`
    - neither: `—`

## Verification
- `./layers/node_modules/.bin/vitest --config layers/bitvocation-content.vitest.config.ts apps/bitvocation/tests/**/*.spec.ts --run`
- Result: `9` files passed, `25` tests passed.
