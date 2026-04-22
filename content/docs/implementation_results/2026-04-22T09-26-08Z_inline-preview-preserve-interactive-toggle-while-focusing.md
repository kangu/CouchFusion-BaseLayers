# Inline Preview: Preserve Interactive Toggle While Focusing

## Initial Prompt
When clicking on the accordion headers, I want them to still expand like they do, but also trigger the event that focuses the right input.

## Plan
1. Inspect inline preview click interception logic.
2. Keep focus event emission intact for `data-prop-id` elements.
3. Avoid blocking native behavior for interactive controls (button/input/etc).

## Implementation Summary
- Updated `layers/content/app/composables/useContentLiveUpdates.ts` in `handleInlinePreviewClick`.
- Existing behavior always called `preventDefault` and `stopPropagation` before emitting `content_inline_prop_click`.
- New behavior:
  - Detects if click originated from an interactive control (`button`, `[role="button"]`, `input`, `select`, `textarea`).
  - If interactive, it **does not** call `preventDefault`/`stopPropagation`.
  - Still emits `notifyInlinePropClick(...)` so the Node Editor focus flow runs.

## Expected Result
Clicking FAQ accordion headers in preview now does both:
1. Toggles accordion open/closed via native component click handling.
2. Focuses the corresponding Node Editor field via inline preview prop-click messaging.

## Proposed Next Steps
1. Verify in inline preview on the FAQ block that question header clicks both toggle and focus `questions[i].question`.
2. If any other interactive component needs this dual behavior, reuse the same pattern (prop marker + preserved native interaction).
