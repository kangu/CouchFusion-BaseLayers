# Node editor stringarray translate buttons

## Issue
Localized `stringarray` fields (example: `Work.badges`) did not show inline `Translate` buttons for individual items in the node editor.

## Root cause
`canTranslateField(...)` helpers only considered:
- `text`
- `textarea`
- rich text component fields

`stringarray` was excluded, so the item-level button rendering condition was false.

## Fix
Updated `canTranslateField(...)` in:
- `layers/content/app/components/builder/node-editor/NodeArrayItem.vue`
- `layers/content/app/components/builder/node-editor/NodeObjectField.vue`
- `layers/content/app/components/builder/node-editor/NodePropsPanel.vue`

New behavior:
- `stringarray` with `localized: true` is treated as translatable.
- Item-level translate buttons are shown for stringarray entries.

## Pointer assignment
- Top-level stringarray item translation path remains item-specific:
  - `[..., propKey, index]` (for example `/2/1/badges/0`)
- Nested stringarray item translation path remains:
  - `[..., fieldKey, index]`

Combined with encoded-pointer precedence fixes, translated array values are now written into the canonical encoded `:prop` payload and assigned to correct indices.
