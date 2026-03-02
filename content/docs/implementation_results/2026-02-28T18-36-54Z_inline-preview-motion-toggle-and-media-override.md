# Initial Prompt
I want to include a top level checkbox at the /Users/radu/Projects/nuxt-apps/layers/content/app/components/builder/Workbench.vue level (close to Save Changes, Delete, etc) which by default is off and sends to the connected iframe on the right doing live rendering the media query parameter for reduce motion. when the toggle is on, it tries to force motion animations through css

# Plan Followed
1. Add a top-level motion toggle in the builder header action row (same action area as Save/Delete controls).
2. Propagate toggle state through the existing editor → iframe message channel.
3. Add a preview URL query parameter so iframe loads with explicit motion mode.
4. Handle the mode inside preview runtime (`useContentLiveUpdates`) and apply CSS overrides for reduce/force behavior.

# Implementation Summary
Implemented a motion-preference control for inline preview with default reduced motion and force-motion override.

Changed files:
- `layers/content/app/components/admin/ContentAdminWorkbench.vue`
- `layers/content/app/components/inline/InlineLiveEditor.vue`
- `layers/content/app/composables/useContentLiveUpdates.ts`

Behavior:
- New checkbox in header actions: **Force Motion**
  - default: off
  - off => preview preference `reduce`
  - on => preview preference `force`
- `ContentAdminWorkbench` emits `preview-motion-change` with payload:
  - `{ forceMotion, mediaPreference }`
- `InlineLiveEditor`:
  - receives `preview-motion-change`
  - sends postMessage to iframe:
    - `type: "builder_motion_preference"`
    - `payload: { mode: "reduce" | "force" }`
  - appends iframe query parameter:
    - `preview-motion=reduce|force`
- `useContentLiveUpdates` (inside iframe):
  - reads initial `preview-motion` query param on mount
  - listens for `builder_motion_preference` messages
  - applies CSS override style:
    - `reduce`: suppress animations/transitions aggressively
    - `force`: attempts to re-enable motion under `prefers-reduced-motion: reduce` via CSS overrides

# Proposed Next Steps
1. Validate in inline editor flow that toggling **Force Motion** changes preview behavior without reload.
2. If needed, tune the force-mode CSS durations to better match your desired animation intensity.
