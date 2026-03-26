# Initial Prompt
Upadte the /admin/events/conferences page so the filter for Years include an extra option for TBA, which filters the documents which don't have a startDateIso value, thus have no automatic calculated Year, and that in the conferences list ends up as "TBA".

## Plan
1. Update admin conferences Year filter UI to add a `TBA` option.
2. Update admin page query-building logic to send `year=tba` when that option is selected.
3. Update server-side conferences list API to understand `year=tba` and filter rows with missing `startDateIso`.
4. Keep existing table rendering unchanged where missing `startDateIso` already renders as `TBA`.

## Implementation Summary
- In `layers/events/app/pages/admin/events/conferences.vue`:
  - Added `<option value="tba">TBA</option>` in the Years filter select.
  - Updated `listQuery` so:
    - `query.year = "tba"` when `queryState.year === "tba"`
    - Numeric year values are still sent as integers.
- In `layers/events/server/api/events/conferences/index.get.ts`:
  - Added `parseYearFilter()` to support `number | "tba" | null`.
  - Updated year filtering logic:
    - `year=tba` now returns conferences where `startDateIso` is missing/empty.
    - Numeric years continue to match `doc.year`.
- Existing list display already shows `TBA` for rows without `startDateIso` via `conferenceMonthLabel`, so no table rendering changes were required.

## Next Steps
1. If needed, apply the same `TBA` year filtering behavior to any other admin/public endpoints that consume year query params for consistency.
