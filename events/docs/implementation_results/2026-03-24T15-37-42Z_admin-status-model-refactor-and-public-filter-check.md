# Admin Status Model Refactor + Public Conferences Filter Check

## Scope
Refactored conference status handling to the new canonical set:
- To be Contacted
- In progress
- Done (confirmed)
- Declined

Also checked public `/conferences` for status filter removal.

## Mapping Applied
- `Not started` -> `To be Contacted`
- `In progress` -> `In progress`
- `Completed` -> `Done (confirmed)`
- `Declined` -> `Declined`
- `Blocked` -> `To be Contacted`
- `Archived` -> `To be Contacted`
- Unknown/empty -> `To be Contacted`

## Implementation Details
- Added shared server status normalizer utility and canonical options.
- Applied canonicalization in:
  - admin list API reads/filtering/counts
  - conference create API
  - conference patch API
  - CSV import parser
- Updated admin UI status options/defaults/tone rendering to the canonical set.

## Public `/conferences` Status Filter
- No status filter controls were present in `apps/bitvocation/app/pages/conferences.vue` at implementation time, so no removal patch was required.

## Files
- `layers/events/server/utils/conference-status.ts`
- `layers/events/server/api/events/conferences/index.get.ts`
- `layers/events/server/api/events/conferences/index.post.ts`
- `layers/events/server/api/events/conferences/[id].patch.ts`
- `layers/events/server/utils/conference-csv.ts`
- `layers/events/app/pages/admin/events/conferences.vue`

## Verification
- `cd apps/bitvocation && bun run build` (pass)
