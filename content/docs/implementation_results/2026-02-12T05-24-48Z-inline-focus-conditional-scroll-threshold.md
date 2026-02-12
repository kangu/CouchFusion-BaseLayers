# Inline Focus Conditional Scroll Threshold

## Initial Prompt
When focusing a clicked node, iframe scrolling was too aggressive and kept snapping longer sections to the top. Scroll should only happen when the target is out of viewport by more than 80%.

## Implementation Summary
- Updated focus behavior in `useContentLiveUpdates` to compute viewport visibility of the target element before scrolling.
- Added conditional scrolling: `scrollIntoView` now runs only when the element is more than 80% out of view (visible area below 20%).
- Highlight application remains unchanged, so in-viewport targets still get focus styling without forced scroll.

## Key File
- `layers/content/app/composables/useContentLiveUpdates.ts`

## Verification Guidance
1. Open `/k/...` and select nodes inside a long section while staying near the target area.
2. Confirm highlight updates without jumping scroll when target is mostly visible.
3. Select a node in a distant section and confirm smooth scrolling still occurs.

## Notes
- No automated tests were run for this adjustment in this change set.
