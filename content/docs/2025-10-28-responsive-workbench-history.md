# Responsive Workbench History

## Initial Prompt
```
Inside the ContentAdminWorkbench component, within the .content-admin-workbench__editor-body component, implement CSS container queries functionality so that when the .content-admin-workbench__editor-body element is less than 1000px, the .content-admin-workbench__editor-sidebar (which holds the History selection) renders at the top of the Content Builder component, with the previous history versions being available in a dropdown rather than regular buttons. The goal is to have the Content Builder interface occupy the full width of the container for smaller widths renderings.
```

## Implementation Summary
Added container-query-aware layout handling to `ContentAdminWorkbench`, detecting narrow widths via `ResizeObserver`, moving the history controls into a condensed dropdown above the builder, and ensuring the editor canvas spans the full container at less than 1000 px.

## Documentation Overview
- `.content-admin-workbench__editor-body` now declares `container-type: inline-size`, with a paired observer updating an `isCondensed` flag so script logic can swap the sidebar buttons for a dropdown while CSS widens the builder.
- The condensed history block surfaces a `<select>` element mirroring the existing history buttons, including current-version resets, loading/empty states, and reuse of `handleSelectHistory`.
- Styling refinements hide the sidebar, reveal the dropdown, and tighten canvas padding when the container shrinks, providing a full-width authoring experience on smaller screens.

## Implementation Examples
```vue
<div
  ref="editorBodyRef"
  class="content-admin-workbench__editor-body"
>
  <div v-if="isCondensed" class="content-admin-workbench__condensed-history">
    <select :value="condensedHistoryValue" @change="handleCondensedHistoryChange">
      <option value="">Current version</option>
      <option v-for="entry in historyEntries" :key="entry.id" :value="entry.id">
        {{ formatHistoryLabel(entry.timestamp) }}
      </option>
    </select>
  </div>
  <!-- existing sidebar/canvas -->
</div>
```

```ts
const updateCondensedState = () => {
  const element = editorBodyRef.value
  if (!element) return
  isCondensed.value = element.getBoundingClientRect().width < 1000
}
```
