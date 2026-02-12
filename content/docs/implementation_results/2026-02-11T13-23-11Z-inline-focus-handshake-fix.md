# Inline Focus Handshake Fix (`/k`)

## Initial Prompt
When I initially load the `/k` route to enable live-editing, focusing/highlighting nodes in the iframe does not work until after a change (e.g. Save Changes). Investigate and propose/fix.

## Root Cause
- Focus highlighting depends on finding runtime nodes by `data-builder-uid` in the iframe page.
- Those attributes are delivered through `live_updates` messages from the inline editor preview pipeline.
- On initial `/k` load, parent-side messages could be posted before the iframe page had mounted `useContentLiveUpdates` and attached the `message` listener.
- If that first `live_updates` payload is missed, the iframe DOM has no `data-builder-uid`; subsequent `builder_focus` messages cannot resolve targets.
- Saving later triggers another preview update, which repopulates annotated DOM and makes focus appear to “start working”.

## Implementation
- Added an explicit preview-ready handshake:
  - iframe preview now posts `content_inline_preview_ready` to parent when `useContentLiveUpdates` mounts in inline preview mode.
  - parent (`InlineLiveEditor`) listens for this signal from the active iframe window.
- Added parent-side readiness gating and queueing:
  - outbound `live_updates` and `builder_focus` now require both:
    - iframe loaded (`isIframeReady`)
    - preview client listener ready (`isPreviewClientReady`)
  - if not ready, messages are queued (`pendingLiveUpdate`, `pendingFocusTarget`) and flushed on handshake.
- Reset readiness state when path/iframe context changes to avoid stale readiness across reloads.

## Key Files
- `layers/content/app/components/inline/InlineLiveEditor.vue`
- `layers/content/app/composables/useContentLiveUpdates.ts`

## Verification Guidance
1. Open inline editor at `/k/...`.
2. Without saving, click several nodes in the builder tree.
3. Confirm iframe immediately scrolls/highlights target elements on first interaction.
4. Confirm behavior still works after route/path changes and after save.

## Notes
- No automated test was added for this handshake in this change set.
