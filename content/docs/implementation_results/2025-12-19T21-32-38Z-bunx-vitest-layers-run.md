# Bunx Vitest Layers Run

## Initial prompt
Run bunx vitest from the /layers folder, no other params.

## Implementation Summary
Implementation Summary: Ran `bunx vitest` from `/Users/radu/Projects/nuxt-apps/layers` and observed two failing tests in the NodeEditor suite: extra-prop filtering expected a non-match that actually matches a substring, and the collapse test reported the panel body still not visible after toggling.

## Documentation Overview
- `content/tests/builder/node-editor-search.spec.ts` fails because the `dataId` extra prop uses the value `"unmatched"`, which includes the substring `"match"` and therefore should match the query.
- `content/tests/builder/node-editor-collapse.spec.ts` fails on `isVisible()` after the expand toggle; the element still reports not visible even though the toggle state is expanded.

## Implementation Examples
```bash
cd /Users/radu/Projects/nuxt-apps/layers
bunx vitest
```
