# Initial Prompt
For link elements which contain props, the current behavior currently stops the click event from propagating and following the link. This is correct, let's keep it like this, but let's add an additional data prop follow link ID which behaves like when the link is double-clicked the URL or its action is followed. Then the final result is clicking once on a link would highlight it in the node editor text and double clicking it would resume its natural behavior. Is there a better recommended way of doing this instead of double clicking?

# Plan Followed
1. Extend inline preview click interception with optional follow intent on marked elements.
2. Use a dedicated data attribute (`data-prop-follow-link-id`) to scope this behavior only where needed.
3. Keep single-click behavior unchanged (prop focus + editor sync), while allowing natural action on follow gestures.
4. Add modifier support (`Cmd/Ctrl+click`) to preserve native browser new-tab behavior.

# Proposed Next Steps
1. Roll out `data-prop-follow-link-id` to additional content links/buttons where inline follow behavior is needed.
2. If desired, expose follow gesture settings (double-click window and movement tolerance) via content-layer runtime config.

# Implementation Summary
- Updated `layers/content/app/composables/useContentLiveUpdates.ts`:
  - Added follow gesture handling gated by `data-prop-follow-link-id`.
  - Added helper `shouldAllowNaturalFollow(event, target)`.
  - Behavior:
    - `Cmd/Ctrl+click`: no interception, native browser behavior is preserved.
    - double-click same follow ID within gesture window: no interception, element's natural action executes.
    - all other clicks: existing inline prop-click interception remains unchanged.
  - Added gesture tuning constants:
    - `FOLLOW_GESTURE_WINDOW_MS = 420`
    - `FOLLOW_GESTURE_MAX_DISTANCE_PX = 12`

This keeps the editor-first single-click workflow while enabling explicit follow actions when requested.
