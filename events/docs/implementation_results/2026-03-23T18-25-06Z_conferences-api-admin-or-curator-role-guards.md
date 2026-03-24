# Conferences API Role Guards: Admin Or Curator

## Scope
- Folder: `layers/events/server/api/events/conferences`
- Requirement: all conference admin APIs should allow either `admin` or `curator` roles.

## Changes
Updated routes that were still admin-only by default:
- `conferences/[id].patch.ts`
- `conferences/index.post.ts`
- `conferences/import-csv.post.ts`

Each now calls:
- `assertEventsAdminSession(event, ["admin", "curator"])`

## Verification
- Searched all `assertEventsAdminSession(event...)` calls in the conferences API folder.
- Confirmed every route in `conferences` now explicitly allows both `admin` and `curator`.
