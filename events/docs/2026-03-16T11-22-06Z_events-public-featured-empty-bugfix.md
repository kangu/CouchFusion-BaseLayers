# Initial Prompt
I see the http://localhost:5984/bv--events/events_featured_conferences document having some featured conferences saved, but /api/events/public/conferences returns featured: []. Investigate and fix

# Plan
1. Inspect featured document content in CouchDB and compare with public endpoint filtering logic.
2. Identify why featured items are dropped.
3. Apply a minimal fix in the public endpoint only.
4. Re-validate endpoint and page output.

# Implementation Summary
- Root cause found: `featured` was resolved using the **month-filtered** public list (`current month or future` only).
- The featured conference IDs in the stored document pointed to conferences with `startDateIso` in past months, so they were filtered out before featured join.
- Updated `layers/events/server/api/events/public/conferences.get.ts`:
  - build `allPublishedConferences` first,
  - keep list filtering (`basePublishedConferences`) for regular `conferences` output,
  - resolve `featured` against `allPublishedConferences` (published-only), preserving admin-configured ordering.

# Verification
- `GET /api/events/public/conferences` now returns `featured_count = 2` for stored entries.
- `/conferences` now renders Featured section with:
  - `Plan B Lugano`,
  - `Adopting Bitcoin`.

# Next Steps
1. If desired, enforce a separate admin validation warning when featuring conferences with past dates.
