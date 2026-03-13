# Events Admin Published Quick Toggle

## Scope
Updated the conferences admin table to support quick published toggling from the `Published` column.

## Behavior
- Clicking a row's published badge now triggers a fast document update:
  - `false -> true`: saves immediately.
  - `true -> false`: opens a small inline confirmation popout.
- Table rows update in place (optimistic UI) to avoid list jump/repaint.
- On save failure, published state is rolled back and an inline error is shown.
- Inline error message is shown above the table if the toggle update fails.

## Technical Notes
- Uses `PATCH /api/events/conferences/:id` with minimal payload:
  - `isPublished`
  - `updatedAt`
- Applies local row patching (instead of full `refreshConferences()` re-fetch) for smoother UX.
- Patch updates replace `conferencesData.value` immutably (including publication counts) so UI updates immediately even with shallow async-data refs.

## File
- `layers/events/app/pages/admin/events/conferences.vue`
