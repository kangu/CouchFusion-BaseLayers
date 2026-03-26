# Initial Prompt
Provide an option to delete a conference from the edit screen. Make sure to ask for confirmation before proceeding with the delete.

## Plan
1. Add a server endpoint to delete a conference by id with admin/curator authorization.
2. Add a Delete action in the conference edit modal footer.
3. Require user confirmation (`window.confirm`) before triggering delete.
4. Refresh the conferences list and close the editor after successful deletion.

## Implementation Summary
- Added API endpoint:
  - `layers/events/server/api/events/conferences/[id].delete.ts`
  - Enforces `assertEventsAdminSession(event, ["admin", "curator"])`
  - Validates conference existence/type/revision
  - Deletes document via `deleteDocument(...)`
- Updated admin editor UI:
  - `layers/events/app/pages/admin/events/conferences.vue`
  - Added `deleteConferenceFromEditor()` action.
  - Shows confirmation dialog before deleting:
    - `Delete conference "<name>"? This action cannot be undone.`
  - Calls `DELETE /api/events/conferences/:id` on confirm.
  - On success: refreshes list, closes editor, and shows `Conference deleted.`
  - Added red `Delete Conference` button in edit modal footer.

## Next Steps
1. If needed, we can add role-based UI hiding so only admins see the delete button while curators keep edit-only access.
