## Initial Prompt
Implement all strategies and let users choose case by case

## Implementation Summary
Implementation Summary: Added safe/force sync-up and sync-down endpoints and wired per-document actions into the Compare Docs dialog with inline status feedback.

## Documentation Overview
- New sync endpoints copy documents between local and remote databases with conflict-aware modes.
- Compare Docs dialog now includes actions for down/up sync in safe or force mode.

## Implementation Examples
```ts
await $fetch('/api/datasync/doc/sync-down', { method: 'POST', body: { dbName, docId, mode: 'safe' } })
```
