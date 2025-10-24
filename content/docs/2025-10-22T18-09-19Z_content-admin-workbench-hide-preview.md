# Content Admin Workbench Hide Preview

## Initial Prompt
```
On the content module, for the ContentAdminWorkbench component, add a prop for "hidePreview", which if set, don't show the preview section at the bottom. The prop should be off by default, and turned on when instantiated through InlineLiveEditor
```

## Implementation Summary
Introduced a `hidePreview` prop on `ContentAdminWorkbench` and defaulted it to `false`, while `InlineLiveEditor` now enables the flag so the inline builder layout can omit the embedded preview pane.

## Documentation Overview
- `ContentAdminWorkbench` accepts `hidePreview`; when `true` it skips the preview heading and applies compact styling to the builder canvas.
- Added lightweight preview label styling so the original layout still looks intentional when the preview is displayed.
- `InlineLiveEditor` forwards `hidePreview: true` through its workbench props, keeping the inline authoring experience focused on the iframe preview.

## Implementation Examples
```ts
const props = defineProps<{
  hidePreview?: boolean
}>()

const hidePreview = computed(() => props.hidePreview === true)
```

```vue
<div v-if="!hidePreview" class="editor-canvas__preview-label">
  <h2 class="preview-title">Preview</h2>
  <p class="preview-subtitle">
    Rendered output of the current content document.
  </p>
</div>
```

```ts
const workbenchProps = computed(() => ({
  hidePreview: true,
  ...(props.workbench ?? {})
}))
```
