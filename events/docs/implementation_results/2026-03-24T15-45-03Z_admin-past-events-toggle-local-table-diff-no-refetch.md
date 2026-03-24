# Admin Past Events Toggle: Local Table Diff (No Refetch)

## Scope
Adjusted `/admin/events/conferences` so toggling `Past events` no longer refetches conference data or triggers full loading-state redraw.

## Changes
- Kept API query pinned to `includePast=true` for board fetches.
- Moved `Past events` behavior to client-side filtering of already-loaded rows.
- `sortedConferences` now derives from client-side `visibleConferences`.
- Empty-state condition now follows `sortedConferences.length` to match visible rows.

## Result
- Toggling `Past events` updates only table row diffs and counters bound to visible list length, with minimal jump/redraw.

## Files
- `layers/events/app/pages/admin/events/conferences.vue`

## Verification
- `cd apps/bitvocation && bun run build` (pass)
