# NodeEditor Baseline Tests

## Initial prompt
The plan is approved. Start with the baseline tests, finish with all the tests eventually.
Tests should be under layers/content/tests/. Ok to use existing jsdom. Baseline tests should include array-item filtering and extra prop filtering. Also test expand/collapse and nesting.

## Implementation Summary
Implementation Summary: Added Vitest coverage for builder search utilities and NodeEditor search/filter behavior, including array and extra-prop filtering, collapse states, select match classes, and textarea highlight scroll sync.

## Documentation Overview
- Added builder search unit tests for query normalization, value matching (including circular refs), text/template nodes, and parent retention.
- Added NodeEditor search tests for prop filtering, jsonarray/stringarray item filtering, nested array matches, extra prop filtering, and child node filtering.
- Added NodeEditor collapse tests for node panels and nested array toggles.
- Added NodeEditor highlight tests for matched inputs, select match classes (including custom UI), and textarea highlight scroll syncing.

## Implementation Examples
```ts
/** @vitest-environment jsdom */
import { mountNodeEditor, expandNode } from "./node-editor-test-utils";

const wrapper = mountNodeEditor({ node, searchQuery: "match" });
await expandNode(wrapper);
```
