# Node editor range sliders show live value

## Scope
- Layer: `layers/content`
- File: `app/components/builder/node-editor/NodePropsPanel.vue`

## Changes
- Added a range-specific layout for primitive fields in Node Props panel:
  - when `ui.widget === 'range'`, render the slider with a right-side value badge.
- Added helper formatting so live value display remains stable for numeric/string draft values.
- Non-range fields keep existing rendering path.

## Impact
- Editor-only UI enhancement.
- No runtime/page rendering behavior changes.

## Validation
- `npx nuxi prepare` passed in `apps/nuxt-app-starter`.
