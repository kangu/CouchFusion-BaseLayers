# Inline Editor Layout Update

## Initial Prompt
```
Back to working with the inline site builder. The /builder page should not use the members.vue layout, it should ideally have no layout and only the two top level components. Can that be acheived?
```

## Implementation Summary
Adjusted the inline editor shell to occupy the full viewport and rely on no external layout so consuming pages can render the two-pane workflow directly without inherited wrappers.

## Documentation Overview
- `app/components/inline/InlineLiveEditor.vue` now forces a `100vw × 100vh` grid (with a mobile fallback) so the workbench/preview split stretches edge to edge when no surrounding layout is present.
- This change keeps the component self-contained, letting apps drop it into a layout-free route for dedicated authoring screens.

## Implementation Examples
```vue
<template>
  <InlineLiveEditor initial-path="/" />
</template>
```
