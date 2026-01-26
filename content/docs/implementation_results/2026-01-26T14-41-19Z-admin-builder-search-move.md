## Initial Prompt
Extract the component search UI from the builder workbench into `ContentAdminWorkbench.vue`, placing it in the header (full-width row near the bottom).

## Plan
1. Expose the workbench search query via props/emits so the parent admin workbench can drive it.
2. Remove the inline search input from `builder/Workbench.vue` while keeping normalized search behavior intact.
3. Add a full-width search input to the admin workbench header and pass its value down to the builder.

## Implementation Summary
- Added a controlled `searchQuery` prop/`update:searchQuery` emit to `builder/Workbench.vue`, retaining a fallback internal ref for standalone usage; removed the inline search field from the workbench UI.
- Wired `ContentAdminWorkbench.vue` to own the search state (`builderSearchQuery`), render a full-width search input in the editor header, and pass the value to `BuilderWorkbench` via the new prop.
- Styled the new header row/input to span the full width and match the admin UI.

## Next Steps
- Smoke test in the admin UI: type in the header search and verify builder filtering responds.
- If other consumers still need an inline search inside `Workbench.vue`, consider making the input optional via a flag.
