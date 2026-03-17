# Initial Prompt
I can still see older conferences in the /conferences page like Jan 2026

# Plan
1. Verify which backend endpoint powers `/conferences`.
2. Apply current/future month filtering at that public endpoint only.
3. Keep response shape and existing filters unchanged for minimal impact.

# Implementation Summary
- Identified root cause: `/conferences` uses `layers/events/server/api/events/public/conferences.get.ts` (not the admin endpoint previously changed).
- Updated `layers/events/server/api/events/public/conferences.get.ts` to filter out past-month conferences at source:
  - added `currentUtcMonthKey()` helper,
  - added `monthKeyFromStartDate()` helper,
  - retained only conferences where resolved month key is `>=` current UTC month.
- Conferences with missing/invalid `startDateIso` are now excluded from public conference results.
- No changes to endpoint contract, sorting contract, or frontend code were required.

# Next Steps
1. Refresh `/conferences` and confirm past-month events (e.g. `Jan 2026`) no longer appear.
2. Verify current-month events are still included.
