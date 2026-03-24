# Admin Conferences Past Events Toggle + Session Persistence

## Scope
Added a `Past events` toggle to the `/admin/events/conferences` filter bar.

## Behavior
- Toggle default is `off`.
- When `off`, past conferences are hidden.
- When `on`, past conferences are included.
- Past is defined as `startDateIso < current date`.

## Implementation
- Added server query support for `includePast` on admin conferences index API.
- Added server-side past-event detection (date-only and datetime-safe handling).
- Added UI toggle at end of filter bar.
- Added sessionStorage persistence for admin filters:
  - search
  - status
  - continent
  - year
  - published
  - showPastEvents

## Files
- `layers/events/server/api/events/conferences/index.get.ts`
- `layers/events/app/pages/admin/events/conferences.vue`

## Verification
- `cd apps/bitvocation && bun run build` (pass)
