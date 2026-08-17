# Admin Conferences Remove Pagination

## Initial Prompt

Drop pagination entirely from `/admin/events/conferences`, because pagination controls are not visible.

## Plan

1. Add an endpoint regression test for datasets larger than the existing page size.
2. Remove API pagination parsing, response metadata, and slicing.
3. Remove pagination query parameters from the admin page.
4. Verify the endpoint returns all unfiltered and filtered matches.

## Implementation Summary

- `server/api/events/conferences/index.get.ts` now returns every matching conference, regardless of pagination query parameters.
- `app/pages/admin/events/conferences.vue` no longer sends page or page-size query parameters.
- The existing filters and client-side Past events visibility toggle are unchanged.
- `tests/conferences-index.get.spec.ts` covers 121 unfiltered documents and 61 filtered matches.

## Proposed Next Steps

Open the admin conference list with a production-sized dataset to visually confirm all records are present in the table.
