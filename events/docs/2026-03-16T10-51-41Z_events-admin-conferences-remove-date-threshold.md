# Initial Prompt
Remove the date filter from /Users/radu/Projects/nuxt-apps/layers/events/server/api/events/conferences/index.get.ts, that should return everything as that is the admin endpoint.

# Plan
1. Update only the admin conferences endpoint.
2. Remove the month-threshold helpers and filter step added previously.
3. Keep all existing admin query filters and response shape unchanged.

# Implementation Summary
- Updated `layers/events/server/api/events/conferences/index.get.ts`:
  - removed current/future month helper constants/functions,
  - removed the month-threshold filter from the conference pipeline.
- The admin endpoint now returns conferences across all dates again (subject to existing search/status/continent/year/published filters).
- No changes to auth/role checks, pagination, or response contract.

# Next Steps
1. Reload the admin conferences view and verify older conferences appear again.
2. Keep the public endpoint month filter in place so `/conferences` remains current/future only.
