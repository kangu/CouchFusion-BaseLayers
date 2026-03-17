# Initial Prompt
When focusing an item inside an array structure, make sure to expand that structure no matter how deep it is, so we can then focus the input field.

# Plan Followed
1. Identify where node-editor focus resolves `data-content-prop-path` and where array collapsed state is handled.
2. Add explicit array-path markers to array containers at all supported nesting levels.
3. Update focus flow to expand all collapsed array containers that are path prefixes of the target prop path.
4. Verify with inline preview click-to-focus on an array-backed field (`coreToolkit.0.title`).

# Proposed Next Steps
1. Add an automated regression test for deep array path focus expansion.
2. If needed, extend the same strategy to any future custom field renderers that introduce collapsible structures.

# Implementation Summary
## Root Cause
- Focus logic in `NodeEditor.vue` only force-opened the first top-level array key (`request.propPath[0]`).
- Nested array sections could remain collapsed, so the target field wrapper with matching `data-content-prop-path` was not reachable for focus.

## Changes
- `NodeEditor.vue`
  - Added generic nested expansion helpers:
    - `toPathDepth(...)`
    - `isPathPrefix(...)`
    - `expandCollapsedArrayPaths(panel, propPath)`
  - Before querying `[data-content-prop-path="..."]`, focus flow now expands every collapsed array container whose `data-content-array-path` is a prefix of the target prop path, in shallow-to-deep order.

- `NodeArrayField.vue`
  - Added `:data-content-array-path="toPropPathAttr(pathPrefix)"` on the top-level array container.
  - Added `toPropPathAttr(...)` helper for consistent path serialization.

- `NodeObjectField.vue`
  - Added `:data-content-array-path="toPropPathAttr([...pathPrefix, field.key])"` on nested `jsonarray` containers.

- `NodeArrayItem.vue`
  - Added `data-content-array-path` on all nested array containers:
    - nested `stringarray`: `toPropPathAttr([...pathPrefix, field.key])`
    - nested `jsonarray`: `toPropPathAttr([...pathPrefix, field.key])`
    - deep nested `stringarray` inside nested jsonarray item:
      `toPropPathAttr([...pathPrefix, field.key, nestedIndex, nestedField.key])`

## Verification
- Playwright MCP on `http://localhost:7833/k`:
  - Clicked `Vision` heading inside preview iframe (`Services` section).
  - Node editor focused `INPUT` with value `Vision` (path `coreToolkit.0.title`), confirming array-backed focus now succeeds with expansion.
