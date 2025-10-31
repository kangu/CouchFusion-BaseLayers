# Duplicate Page Component Filter

## Initial Prompt
```
Extend the Duplicate Page dialog to contain at the bottom a checkable list of all components contained in the current page, with all checked by default. The user can uncheck some of those, and those should not make it into the cloned page.
```

## Implementation Summary
Extended the duplicate-page workflow with a component checklist that defaults to all selected, lets editors deselect nodes, and filters the serialized body before persisting the clone.

## Documentation Overview
- `ContentAdminWorkbench` now snapshots the current builder document when opening Duplicate and builds a hierarchical list of component nodes, each tied to its path within the minimal document.
- New helper utilities (`collectDuplicateNodes`, `filterComponentEntries`) prepare checkbox options and prune the serialized content so unchecked components (including nested ones) are excluded while keeping text nodes intact.
- The Duplicate modal renders an indented checklist, propagates toggles to descendants/ancestors for consistency, and stores the trimmed document before calling `saveDocument` with `POST`.

## Implementation Examples
```ts
const selectedComponentKeys = new Set(
  duplicateNodes.value
    .filter((entry) => entry.selected)
    .map((entry) => entry.key),
)

const filteredBody = filterComponentEntries(
  baseDocument.body?.value,
  [],
  selectedComponentKeys,
)

const duplicatedMinimal: MinimalContentDocument = {
  ...baseDocument,
  id: contentIdFromPath(targetPath),
  path: targetPath,
  body: { type: baseDocument.body?.type ?? 'minimal', value: filteredBody },
  // …
}
```
```vue
<label
  v-for="node in duplicateNodes"
  :key="node.key"
  class="modal__components-item"
  :style="{ '--component-indent': getDuplicateNodeIndent(node) }"
>
  <input
    class="modal__components-checkbox"
    type="checkbox"
    :checked="node.selected"
    @change="handleDuplicateNodeToggle(node.key, $event)"
  />
  <span class="modal__components-label">{{ node.label }}</span>
  <code class="modal__components-code">{{ node.component }}</code>
</label>
```
