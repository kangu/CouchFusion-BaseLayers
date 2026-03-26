# Initial Prompt
Remove the "Start Date Label" entry from the conference document and new/edit dialog.

## Plan
1. Remove `startDateLabel` from admin conferences create/edit form state and payloads.
2. Remove `Start Date Label` inputs from both create and edit dialogs.
3. Remove `startDateLabel` from conference create API payload handling.
4. Ensure patch/update flow strips legacy `startDateLabel` from conference documents.
5. Remove `startDateLabel` from shared `ConferenceDocument` typing and CSV-imported document shape.

## Implementation Summary
- Updated admin page `layers/events/app/pages/admin/events/conferences.vue`:
  - Removed `startDateLabel` from `ConferenceItem`, `createForm`, and `editorForm` state.
  - Removed create/edit payload writes for `startDateLabel`.
  - Removed `Start Date Label` input field from create dialog.
  - Removed `Start Date Label` input field from edit dialog.
- Updated create API `layers/events/server/api/events/conferences/index.post.ts`:
  - Removed `startDateLabel` from `ConferenceCreatePayload`.
  - Removed `startDateLabel` persistence from created conference documents.
- Updated patch API `layers/events/server/api/events/conferences/[id].patch.ts`:
  - Removed `startDateLabel` from patch payload interface and parsing.
  - Removed assignment of `startDateLabel` in merged document update.
  - Added explicit `delete nextConference.startDateLabel` so saving an edited conference removes any legacy field from existing docs.
- Updated shared type/import mapper `layers/events/server/utils/conference-csv.ts`:
  - Removed `startDateLabel` from `ConferenceDocument` interface.
  - Removed `startDateLabel` property from parsed conference document mapping.

## Next Steps
1. If desired, we can add a one-time migration script to clean legacy `startDateLabel` from all conference docs without requiring edits.
