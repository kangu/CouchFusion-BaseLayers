# Inline preview prop-click focus bridge (builder sidebar)

## Request
Continue the live-editor plan so clicking a `data-prop-id` element in inline preview can be forwarded to the content workbench and focus the matching prop field.

## What was implemented
- Completed the missing bridge in `ContentAdminWorkbench` so inline preview click payloads can reach the builder workbench focus API.
- Kept behavior safe/no-op when payload or builder instance is not available.

## Files changed
- `layers/content/app/components/admin/ContentAdminWorkbench.vue`

## Key code updates
1. Extended `BuilderWorkbenchInstance` type to include:
   - `focusNodeProp(payload: { uid: string; propPath: string })`
2. Added `focusPropFromPreview(payload)` method in `ContentAdminWorkbench`:
   - validates payload shape
   - forwards `{ uid, propPath }` to `builderRef.value.focusNodeProp(...)`
3. Exposed the method via `defineExpose`:
   - `focusPropFromPreview`

## Validation status
- Attempted typecheck in `apps/radustanciu`, but the workspace currently has many unrelated pre-existing TypeScript errors, so this is not a reliable gate for this feature.
- Live runtime test was prepared (dev server launched), then handed off for manual validation by request.

## Notes
- This bridges the previously added message flow:
  - inline preview emits `content_inline_prop_click`
  - inline editor receives it and calls `workbenchRef.focusPropFromPreview(...)`
  - admin workbench now forwards into builder `focusNodeProp(...)`
