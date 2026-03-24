# Admin Conferences Hero Stats From Unfiltered Dataset

## Scope
Changed admin conferences hero metric cards to always reflect global (unfiltered) conference totals, regardless of active table filters.

## Changes
- Extended `/api/events/conferences` response with `unfilteredCounts` computed from the full conference dataset before applying UI query filters.
- Updated admin conferences page to bind top hero cards to `unfilteredCounts`:
  - Conferences
  - Dates Confirmed
  - In Progress
  - Published
  - Draft
- Left list/table filtering behavior unchanged.

## Files
- `layers/events/server/api/events/conferences/index.get.ts`
- `layers/events/app/pages/admin/events/conferences.vue`

## Verification
- `cd apps/bitvocation && bun run build` (pass)

## Follow-up
- On 2026-03-24, the `confirmedDates` field and "Dates Confirmed" hero card were removed from the admin conference interface and API contracts.
