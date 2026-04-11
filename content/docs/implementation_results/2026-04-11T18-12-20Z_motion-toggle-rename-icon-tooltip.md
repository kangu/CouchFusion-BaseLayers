# Initial Prompt
I want to rename "Force Motion" into "Keep Animations Running" and transform that into an icon-only element with a helpful tooltip on hover, not the basic "title" attribute but a fancier tailwindcss styled one

# Plan
1. Locate the existing motion toggle markup/state in `ContentAdminWorkbench.vue`.
2. Replace text checkbox control with icon-only toggle button while keeping `forcePreviewMotion` state wiring unchanged.
3. Replace `title` usage with a styled hover/focus tooltip.
4. Keep runtime/emit behavior unchanged (`preview-motion-change` watcher remains intact).
5. Run baseline server tests from consuming app workspace.

# Implementation Summary
Updated `layers/content/app/components/admin/ContentAdminWorkbench.vue`.

## UI changes
- Replaced the old checkbox + text label (`Force Motion`) with an icon-only toggle button.
- New accessible labels now use the requested wording:
  - `Keep Animations Running`
- Tooltip implementation:
  - custom styled floating tooltip element rendered in template
  - shown on hover/focus using CSS transitions
  - includes title + state (`Enabled` / `Disabled`)
  - no `title` attribute used

## Behavior impact
- No change to motion toggle behavior logic:
  - `forcePreviewMotion` still drives `preview-motion-change` emission.
  - Existing watchers/message flow remain unchanged.
- Production runtime impact is minimal:
  - purely presentation-layer markup/CSS changes in existing component.

# Verification
- Passed:
  - `cd apps/nuxt-app-starter && bun run test:server`
- Result: 4 tests passed, 0 failed.

# Proposed Next Steps
1. Optional: visually verify tooltip placement in narrower widths and adjust offsets if needed.
