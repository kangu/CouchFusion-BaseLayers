# Node Editor Localized Prop Shiny Outline

Date: 2026-03-05

## Request
- Apply a shiny outline to node editor elements representing localized props.
- Keep the look aligned with the current admin theme and support nested/deep fields.

## Implementation
- Added localized class plumbing at field wrapper level:
  - `NodeField` now accepts `isLocalized` and applies `node-panel__field--localized`.
  - `NodePropsPanel` passes `prop.localized` to `NodeField` for top-level props.
- Added localized class binding for nested wrappers:
  - `NodeObjectField` for object fields and nested array fields.
  - `NodeArrayItem` for array-item fields, nested string-array entries, nested jsonarray fields, and top-level stringarray entries.
- Added shared localized visual style in `NodeEditor`:
  - subtle blue outline + glow + inner highlight using `box-shadow`, matching existing cool-blue admin palette.

## Files Updated
- `content/app/components/builder/node-editor/NodeField.vue`
- `content/app/components/builder/node-editor/NodePropsPanel.vue`
- `content/app/components/builder/node-editor/NodeObjectField.vue`
- `content/app/components/builder/node-editor/NodeArrayItem.vue`
- `content/app/components/builder/NodeEditor.vue`

## Validation
- `bun run build` in `apps/radustanciu` passed (SSR/client build successful).
- `bunx vitest --config layers/vitest.config.ts` failed due environment/setup issues unrelated to this change (`Cannot find module '/Users/radu/Projects/nuxt-apps/_tests/setup/content.ts'` and missing `jsdom` in bunx temp runner).
