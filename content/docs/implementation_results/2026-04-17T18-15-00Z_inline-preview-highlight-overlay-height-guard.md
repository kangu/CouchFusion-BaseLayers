# Inline preview highlight overlay height guard

## Request
Investigate edit-time live preview behavior where iframe content occasionally grows with non-interactive blank white space until full refresh.

## Root Cause
The inline-preview focus highlight overlay in `useContentLiveUpdates.ts` was rendered as `position: absolute` and appended to `document.body`.

When live editing moved/replaced nodes, stale overlay geometry could remain far below current content, increasing the document scrollable extent and producing a visible blank area.

## Changes
- Updated highlight overlay positioning from `absolute` to `fixed`.
- Added base fixed offsets (`top: 0`, `left: 0`) and kept transform-based placement.
- Cleared any active highlight overlay before applying each incoming `live_updates` payload.
- Added unmount cleanup to remove the overlay DOM node and reset the singleton reference.

## Files
- `layers/content/app/composables/useContentLiveUpdates.ts`

## Verification
- `cd apps/nuxt-app-starter && bunx nuxi prepare` passes.
