# Initial Prompt
The animations are still showing, although indeed with reduced animation but only for effects, not for entry. When reduce animation is on, I want all animations to be disabled, completely

# Plan Followed
1. Strengthen reduce-motion CSS override to fully disable transitions and animations.
2. Apply the motion preference earlier in preview lifecycle so entry animations are blocked on initial render.

# Implementation Summary
Updated `useContentLiveUpdates` to fully disable animation when reduced motion is active.

File changed:
- `layers/content/app/composables/useContentLiveUpdates.ts`

Changes:
- In reduce mode, CSS override now uses:
  - `animation: none !important;`
  - `transition: none !important;`
  - plus zeroed duration/delay fallback declarations.
- Moved initial motion preference application earlier:
  - `applyMotionPreference(getInitialMotionPreference())` now runs immediately in composable setup (for inline preview), not only on `onMounted`.

Result:
- Reduced-motion mode now hard-disables both effect and entry animations in the inline preview iframe.
