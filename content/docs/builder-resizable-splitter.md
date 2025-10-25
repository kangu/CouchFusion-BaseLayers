## Initial Prompt
```
Add in a minimalistic draggable splitter that separates the builder sidebar and the iframe from the /builder page, allowing users to resize them.
```

## Implementation Summary
Implementation Summary: Introduced a draggable divider to InlineLiveEditor so editors can resize the workbench sidebar and preview pane on /builder (and its aliases).

## Documentation Overview
- Added reactive sidebar sizing with clamped bounds, persisted across drag sessions during a page view and recalculated on window resize to keep the preview readable.
- Registered pointer-driven drag handlers that update a CSS variable backing the grid layout, with cleanup on unmount and safe behaviour on touch/desktop devices.
- Styled a slim separator that highlights while dragging and disappears on small screens where the layout collapses to a single column.

## Implementation Examples
```ts
const beginDividerDrag = (event: PointerEvent) => {
  event.preventDefault()
  isDraggingDivider.value = true
  dragStartX.value = event.clientX
  dragStartWidth.value = sidebarWidth.value
  window.addEventListener('pointermove', handleDividerDrag, { passive: true })
  window.addEventListener('pointerup', stopDividerDrag, { passive: true })
}
```
```vue
<div
  class="inline-live-editor"
  :style="{ '--inline-sidebar-width': `${sidebarWidth}px` }"
>
  <section class="inline-live-editor__sidebar">…</section>
  <div class="inline-live-editor__divider" role="separator" @pointerdown="beginDividerDrag" />
  <section class="inline-live-editor__preview">…</section>
</div>
```
