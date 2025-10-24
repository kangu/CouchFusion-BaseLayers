# Content Admin Workbench Hide Preview

## Initial Prompt
```
On the content module, for the ContentAdminWorkbench component, add a prop for "hidePreview", which if set, don't show the preview section at the bottom. The prop should be off by default, and turned on when instantiated through InlineLiveEditor
```

## Plan
1. Update `ContentAdminWorkbench` to accept a `hidePreview` prop and conditionally render the preview section.  
2. Adjust `InlineLiveEditor` so it forwards the flag when instantiating the workbench.  
3. Document the change and note follow-up steps.

## Implementation Summary
`ContentAdminWorkbench` now respects a `hidePreview` boolean, while `InlineLiveEditor` passes `hidePreview: true`; the default remains unchanged, so other consumers continue to see the preview unless they opt out.

## Next Steps
1. Audit other placements of `ContentAdminWorkbench` to decide whether they should surface the new prop.  
2. Verify the inline editor layout once the dev server restarts to confirm the preview pane stays hidden.
