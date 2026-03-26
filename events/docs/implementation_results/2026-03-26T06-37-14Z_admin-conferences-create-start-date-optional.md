# Initial Prompt
Update the conference editor panel for new/edit to allow startDateISO to be set to null. Currently I get this error for "Start Date (ISO) is required in YYYY-MM-DD format."

## Plan
1. Remove the hard requirement for `startDateIso` in the admin conference create dialog validation.
2. Send `startDateIso: null` from create dialog when date input is empty.
3. Update server create endpoint to accept nullable `startDateIso` and avoid deriving date labels when missing.
4. Keep edit behavior unchanged (already supports nullable date).

## Implementation Summary
- Updated `layers/events/app/pages/admin/events/conferences.vue`:
  - In `saveCreateConference`, `startDateIso` validation is now optional:
    - if provided, must match `YYYY-MM-DD`
    - if empty, no validation error
  - Payload now sends `startDateIso: null` when the field is empty.
- Updated `layers/events/server/api/events/conferences/index.post.ts`:
  - Replaced required date parser with `asOptionalIsoDate`.
  - Create endpoint now accepts `startDateIso` as `null`.
  - Fallback derivations for `monthLabel`, `startDateLabel`, and `dateRangeLabel` only run when `startDateIso` exists; otherwise they remain `null`.

## Next Steps
1. If desired, we can auto-fill `year` from `startDateIso` in create when date is provided and year field is blank.
