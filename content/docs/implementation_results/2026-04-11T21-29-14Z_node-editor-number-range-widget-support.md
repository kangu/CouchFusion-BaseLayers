# Node Editor number range widget support

## Scope
- Layer: `layers/content`
- Files:
  - `app/components/builder/node-editor/NodePropsPanel.vue`
  - `app/components/builder/node-editor/NodeTextField.vue`

## Changes
- Added range-widget resolution for numeric props in Node Props panel:
  - if `prop.type === 'number'` and `prop.ui.widget === 'range'` -> render input as `type='range'`
  - otherwise keep existing `type='number'` fallback
- Added numeric UI bound passthrough (`min`, `max`, `step`) from `prop.ui` to `NodeTextField`.
- Extended `NodeTextField` to bind optional `min/max/step` attributes.

## Runtime impact
- No production-facing behavior changes.
- Minimal editor-only impact: only number fields with explicit `ui.widget = 'range'` opt into slider behavior.

## Validation
- Verified via `npx nuxi prepare` in consuming app (`apps/nuxt-app-starter`).
