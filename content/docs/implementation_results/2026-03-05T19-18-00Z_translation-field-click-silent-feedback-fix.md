# Translation Field Click Silent Feedback Fix

## Issue
Pressing inline field `Translate` could appear to do nothing when translation prerequisites were missing (for example, no target locales selected). In contexts without `feedback` handlers, no visible message was shown.

## Fix
- Added local translation notice state in `ContentAdminWorkbench` so blocked actions and failures are always visible in the header status line.
- Added warnings to console for blocked/error states.
- Preserved existing optional external `feedback` callback behavior.

## Behavior now
Inline/section/page translate now shows clear status when:
- no page selected
- history snapshot is active
- no target locales selected
- builder instance is unavailable
- translation request fails

## File updated
- `layers/content/app/components/admin/ContentAdminWorkbench.vue`

## Validation
- `bun run build` in `apps/radustanciu` succeeded.
