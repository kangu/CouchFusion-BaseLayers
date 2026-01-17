## Initial Prompt
The document comparison should open in a full page modal window.

## Implementation Summary
Implementation Summary: Switched the compare-docs dialog to a full-screen modal layout with a flex column body and scrollable content area.

## Documentation Overview
- The comparison dialog now spans the full viewport with a fixed header and scrollable table region.

## Implementation Examples
```vue
<dialog class="backdrop:bg-black/50 m-0 h-screen w-screen max-w-none max-h-none rounded-none">
```
