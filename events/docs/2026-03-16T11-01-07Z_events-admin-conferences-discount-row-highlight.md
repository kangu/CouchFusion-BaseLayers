# Initial Prompt
Inside /admin/events/conferences for the conferences that have a discount associated with them, show them with an light orange background for the table line

# Plan
1. Add a lightweight row-level discount detector on the admin conferences page.
2. Apply a light orange background class to rows where discount data exists.
3. Keep all other table behavior unchanged.

# Implementation Summary
- Updated `layers/events/app/pages/admin/events/conferences.vue`:
  - added `hasConferenceDiscount(conference)` helper that checks `discountCode` or `discountLabel`,
  - applied conditional row styling `bg-orange-50/70` for discounted conferences,
  - preserved existing hover behavior and all table interactions.
- No API or query behavior changes were made.

# Next Steps
1. Reload `/admin/events/conferences` and verify discounted rows are highlighted in light orange.
