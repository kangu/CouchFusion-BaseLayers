# ImageKit Adjustments Persistence in Builder Props

## Scope
- Layer: `content`
- Files updated:
  - `/Users/radu/Projects/nuxt-apps/layers/content/app/components/builder/NodeEditor.vue`
  - `/Users/radu/Projects/nuxt-apps/layers/content/app/components/builder/node-editor/NodePropsPanel.vue`

## Problem
When editing ImageKit adjustment controls in `ContentImageField`, transformations were propagated to downstream rendering but the controls could snap back to defaults. On reload, adjustments could also be missing from control initialization.

## Root cause
1. Top-level `update:transformValue` events in `NodePropsPanel` were debounced to persistence but did not immediately update `propDraft` companion state.
2. `NodeEditor` draft hydration did not explicitly restore top-level ImageKit companion props (`<imageKey>ImagekitTransforms`) into `propDraft`.

## Changes
1. Immediate draft sync on transform edits (`NodePropsPanel`)
- For ImageKit transform updates, companion key draft is updated immediately:
  - `propDraft[companionKey] = normalized ?? ''`
- Debounced persistence still runs via `schedulePropUpdate(companionKey, normalized, 'text')`.

2. Companion transform hydration (`NodeEditor`)
- Added top-level hydration for props using `ui.component === 'ContentImageField'`:
  - Computes companion key `${prop.key}ImagekitTransforms`
  - Resolves storage key according to type (`stringarray` companions use `:key` storage)
  - Normalizes into draft (`string[]` for stringarray companions, string for text companions)
  - Stores back in `propDraft[companionKey]`

3. Hide internal companion props from extra-props UI (`NodeEditor`)
- Companion keys ending with `ImagekitTransforms` are excluded from `extraPropEntries` to avoid exposing internal persistence fields in the generic extra-props section.

## Expected behavior after fix
- Adjustments panel values no longer snap back while editing.
- Saved companion transform props are restored on load and initialize controls with latest values.
- Existing downstream transformation propagation remains unchanged.
