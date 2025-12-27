# NodeEditor Refactor Test Evaluation

## Initial prompt
Evaluate what kind of tests could be implemented before the transition so to ensure a proper functionality, then to ensure that the refactor is not breaking anything. Vitest can be used for testing.
Tests should be under layers/content/tests/. Ok to use existing jsdom. Baseline tests should include array-item filtering and extra prop filtering. Also test expand/collapse and nesting.

## Implementation Summary
Outlined a Vitest test matrix for NodeEditor search/filtering, array items, extra props, and collapse/nesting, scoped to layers/content/tests with jsdom.

## Documentation Overview
- Add baseline unit tests for `builderSearch` utilities: `normalizeSearchQuery`, `matchesSearchValue` (primitives, arrays, objects, circular refs), `doesNodeMatchSearch` (text + template node props), and `filterNodesBySearch` (parent retention).
- Add jsdom component tests for `NodeEditor` to cover search filtering across props, nested children, text nodes, slot/template nodes, array-item filtering (`jsonarray`, `stringarray`), and extra prop filtering.
- Add UI-state tests for expand/collapse of nodes and arrays, including nested arrays, to guard against regressions during refactor.
- Keep the baseline tests unchanged post-refactor, and add focused tests for extracted helpers/subcomponents when they exist.

## Implementation Examples
```ts
/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import NodeEditor from "#content/app/components/builder/NodeEditor.vue";

// Example: mount with a registry + node tree, set searchQuery, assert filtered props/children.
```
