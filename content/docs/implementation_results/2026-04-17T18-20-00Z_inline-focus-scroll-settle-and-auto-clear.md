# Inline focus: wait for scroll settle and auto-clear highlight

## Request
- Remove the highlight area when focus animation completes.
- If focus triggers smooth scrolling, delay highlight animation until scroll has settled.

## Changes
Updated `layers/content/app/composables/useContentLiveUpdates.ts`:

- Added focus highlight lifecycle controls:
  - `HIGHLIGHT_FLASH_DURATION_MS` timer management
  - pending timer cancellation on new focus and unmount
- Added `waitForScrollToSettle()` helper:
  - waits for stable scroll position across several animation frames
  - includes max wait guard to avoid hanging
- Updated builder focus handling:
  - when target is outside viewport threshold, trigger smooth scroll first
  - wait for scroll settle
  - only then apply element shadow and overlay highlight
  - stale in-flight focus requests are ignored via request id guard
- Flash-mode overlay now auto-clears after animation duration.
- `clear` mode immediately removes overlay and shadow.

## Verification
- `cd apps/nuxt-app-starter && bunx nuxi prepare` passed.

## Files
- `layers/content/app/composables/useContentLiveUpdates.ts`
