## Initial Prompt
Implement the new specs in layers/database/docs/datasync_functionality.md. Proceed step by step with each section and mark that in the spec document as it's done to be used as reference when resuming work at a future time.

## Implementation Summary
Implementation Summary: Added a compact configured-host banner with Refresh/Edit controls and collapsed the full Data Sync form until edit mode is enabled, while keeping refresh wired to the full fetch flow.

## Documentation Overview
- Data Sync now shows a concise host banner once credentials are set, with a page-wide Refresh action and an Edit toggle that reveals the full form.
- The spec checklist is updated with completed banner tasks.

## Implementation Examples
```vue
<div v-if="hasCredentials && !isEditing">
  <button @click="handleRefresh">Refresh</button>
  <button @click="handleEdit">Edit</button>
</div>
```
