# Initial Prompt
When I click on elements from inside jsonobject elements like coreToolkit inside /Users/radu/Projects/nuxt-apps/apps/radustanciu/app/components/content/Services.vue, the node editor element is not focused correctly. Investigate why and fix

# Plan Followed
1. Trace the inline-preview click-to-focus flow from iframe marker extraction to NodeEditor field lookup.
2. Verify emitted `propPath` format from component markers and compare it against NodeEditor’s lookup selector.
3. Inspect node-editor field renderers to confirm which elements expose `data-content-prop-path`.
4. Patch missing path markers in the renderer responsible for array item object fields.
5. Validate with Playwright on `http://localhost:7833/k` by clicking a `coreToolkit` rendered element in the iframe.

# Proposed Next Steps
1. Optionally extend `data-content-prop-path` coverage in `NodeArrayItem.vue` for additional deep nested controls that are currently indirectly covered.
2. Add a lightweight regression test for inline preview focus targeting array-item fields.

# Implementation Summary
## Root Cause
- `Services.vue` emits correct dotted marker paths like `coreToolkit.0.title`.
- `Workbench.vue` correctly parses and forwards this into `NodeEditor` as `['coreToolkit', 0, 'title']`.
- `NodeEditor` tries to focus using selector:
  - `[data-content-prop-path="coreToolkit.0.title"]`
- In `NodeArrayItem.vue`, array-item field wrappers did not include `data-content-prop-path`, so NodeEditor had no matching target to focus.

## Changes Made
- Updated `layers/content/app/components/builder/node-editor/NodeArrayItem.vue`:
  - Added `:data-content-prop-path="toPropPathAttr([...pathPrefix, field.key])"` on array-item object field labels.
  - Added `:data-content-prop-path="toPropPathAttr(pathPrefix)"` on string-array item labels.
  - Added helper `toPropPathAttr(segments)` to normalize path serialization consistently.

## Verification
- Verified with Playwright MCP on `http://localhost:7833/k`:
  - Clicked `Vision` heading in preview iframe (Services section).
  - Node editor auto-expanded `Services` and `Core Toolkit`.
  - Matching `Title` input for first item received focus (`Vision` field active).
- This confirms prop-path resolution now works for array item object fields such as `coreToolkit.<index>.<field>`.
