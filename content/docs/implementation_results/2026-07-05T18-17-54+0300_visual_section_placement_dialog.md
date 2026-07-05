# Visual Section Placement Dialog

## Initial Prompt

Implement a visual placement dialog for root section creation. After selecting a component and entering a section name, the builder should show scaled-down renderings of the current page sections with clickable insertion gaps between them.

## Implementation Summary

- Added `SectionPlacementDialog.vue` to the builder component set.
- The dialog renders root sections through the real runtime `Content` renderer inside a scaled, clipped preview shell.
- Each insertion point is a full-width gap button that emits the selected root index immediately.
- Empty pages show a single placement target.
- Existing inline root insertion buttons still start the same component picker and naming flow, then highlight the suggested gap in the placement dialog.
- Updated `Workbench.vue` so root component naming opens the placement dialog instead of inserting immediately.
- Clicking a placement gap creates the node, applies global alias defaults, inserts at the selected root index, persists the local section name, and closes the add-section workflow.
- Canceling the placement dialog closes the workflow without mutating the builder tree.

## Tests

Executed from `/Users/radu/Projects/nuxt-apps/layers`:

```bash
bunx vitest --config vitest.config.ts content/tests/builder --run
```

Result:

- 14 test files passed.
- 46 tests passed.

Focused coverage added:

- Placement dialog renders section previews and insertion gaps.
- Suggested insertion gap is highlighted without auto-inserting.
- Empty-page placement uses a single insert target.
- Cancel emits only cancel.
- Workbench source contract verifies the add-section flow opens `SectionPlacementDialog` and routes insertion through `confirmRootSectionPlacement`.

## Notes

- Scope stayed limited to root page sections.
- No page document schema changes were made.
- No saved document migration is required.
- A repo-root Vitest invocation is not the valid runner for this layer in the current workspace; the layer-level runner above is the verified command.
