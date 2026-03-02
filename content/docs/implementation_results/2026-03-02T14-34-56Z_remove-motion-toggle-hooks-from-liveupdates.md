# Initial Prompt
Remove the site-wise toggles added inside content/app/composables/useContentLiveUpdates.ts

# Plan Followed
1. Remove all motion-toggle specific message types and handlers from `useContentLiveUpdates.ts`.
2. Remove query-param based motion mode parsing and CSS injection logic.
3. Keep live update and builder focus behavior untouched.

# Implementation Summary
Removed the motion-toggle plumbing from:
- `layers/content/app/composables/useContentLiveUpdates.ts`

Deleted from this composable:
- `builder_motion_preference` message interface/type guards
- `preview-motion` query parsing helpers
- runtime CSS override injection for motion mode
- initial motion preference application in composable setup
- message branch handling motion preference updates

Retained:
- `live_updates` synchronization
- `builder_focus` highlight/scroll logic
- inline preview readiness handshake
