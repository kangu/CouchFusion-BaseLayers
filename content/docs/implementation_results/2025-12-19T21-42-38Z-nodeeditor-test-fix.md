# NodeEditor Test Fixes

## Initial prompt
Remove node-editor-collapse.spec.ts altogether. Why is still the other test not passing?

## Implementation Summary
Implementation Summary: Removed the collapse test file and updated the extra-prop fixture to avoid an unintended substring match so the search filtering test aligns with the case-insensitive substring rules.

## Documentation Overview
- Deleted `layers/content/tests/builder/node-editor-collapse.spec.ts` as requested.
- Updated `dataId` in `layers/content/tests/builder/node-editor-search.spec.ts` to a non-matching value so the extra-prop filtering assertion reflects the intended substring behavior.

## Implementation Examples
```ts
const node = createComponentNode("node-1", "hero", {
  dataId: "neutral",
});
```
