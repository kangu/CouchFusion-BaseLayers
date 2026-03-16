# Initial Prompt
Make it so that the /Users/radu/Projects/nuxt-apps/layers/events/server/api/events/conferences/index.get.ts endpoint only returns conferences which have the start date in the current month or greater. Everything else is to be discarded as far as the frontend is concerned.

# Plan
1. Update only `layers/events/server/api/events/conferences/index.get.ts` to add a month-threshold filter.
2. Compare conference `startDateIso` against current UTC month key (`YYYY-MM`) and keep only current/future months.
3. Exclude missing/invalid start dates to ensure frontend receives only eligible conferences.
4. Keep all existing endpoint behavior (auth, filters, pagination, response shape) unchanged.

# Implementation Summary
- Updated `layers/events/server/api/events/conferences/index.get.ts` with a server-side month gate before existing query filters:
  - added `currentUtcMonthKey()` helper,
  - added `monthKeyFromStartDate()` helper for robust date-only and ISO parsing,
  - filtered conferences to include only records where `monthKey >= currentUtcMonthKey`.
- Records with missing or invalid `startDateIso` are now excluded from this endpoint.
- No changes were made to endpoint contract, query parameters, or response structure.

# Next Steps
1. Open the conferences admin view and verify past-month conferences are no longer returned.
2. Confirm current-month conferences still appear, including those with start dates earlier in the same month.
