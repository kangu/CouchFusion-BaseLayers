# Events Notification Diff + Confirm Preview

## Scope
Improve conference watcher notifications so admins see a confirmation preview with the exact DM text before sending, and include precise object-level field diffs in the message.

## What Changed
- Updated Nostr message diff logic:
  - replaced fixed watched-field list with dynamic diff between previous and next conference objects
  - nested paths are emitted with dot notation (for example `source.rowNumber`)
  - includes all changed business fields such as `discountCode`
  - excludes document/audit noise: `_id`, `_rev`, `type`, `createdAt`, `updatedAt`
- Added server-side preview builder:
  - `previewConferenceWatchersNostrMessage(previous, next, { customMessage })`
  - returns `message`, `changeLines`, eligible watcher count, watcher `npub`s
- Extended conference patch API:
  - new payload flag `previewNotificationOnly: boolean`
  - when `true` and `notifyWatchers=true`, API returns `notificationPreview` without sending notifications and without persisting the document
- Updated admin UI (`/admin/events/conferences`):
  - when "Send Nostr update to watchers before save" is checked, Save now requests preview first
  - opens a confirmation dialog showing exact message text and eligible watchers
  - notifications + save execute only after clicking "Confirm & Save"

## Files
- `events/server/utils/nostr-notifications.ts`
- `events/server/api/events/conferences/[id].patch.ts`
- `events/app/pages/admin/events/conferences.vue`
