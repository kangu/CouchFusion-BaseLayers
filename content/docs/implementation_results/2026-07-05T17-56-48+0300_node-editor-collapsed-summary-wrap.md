# Node Editor Collapsed Summary Wrap

## Initial prompt

Avoid horizontal scrolling caused by the collapsed array summary label. The value preview should be cut off or allowed to use two lines.

## Implementation summary

- Updated `.node-panel__array-summary` in `NodeEditor.vue` so the collapsed preview is a shrinking flex item.
- Replaced single-line nowrap ellipsis with a two-line `-webkit-line-clamp`.
- Added `overflow-wrap: anywhere` so long labels, URLs, or values cannot force the editor wider.

## Files changed

- `app/components/builder/NodeEditor.vue`

## Verification

Run from `/Users/radu/Projects/nuxt-apps/layers`:

```bash
bunx vitest --config vitest.config.ts content/tests/builder/node-editor-summary.spec.ts content/tests/builder/node-editor-search.spec.ts content/tests/builder/node-editor-highlight.spec.ts --run
```

Result: 3 files passed, 8 tests passed.
