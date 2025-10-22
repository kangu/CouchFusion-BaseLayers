# Inline Live Editor Workbench Props

## Initial Prompt
```
I am implementing a /builder page in the pacanele-loading app. Add the Icon.vue component to the project as it is needed to render icons inside the content editor. Make sure to pass some default styles to the InlineLiveEditor and ContentAdminWorkbench further down to render decent looking styles on the content editor component. See attached screenshot for how it's currently looking [Screenshot 2025-10-22 at 15.57.54.png 1296x2660]
```

## Implementation Summary
Extended `InlineLiveEditor` so consuming apps can forward props to `ContentAdminWorkbench`, enabling branded titles, copy, and UI class overrides without rewriting the shared builder shell.

## Documentation Overview
- `InlineLiveEditor` now accepts a `workbench` prop typed from the underlying component; it’s merged into the workbench via `v-bind`, while existing `initialPath` wiring remains intact.
- Consumers can pass partial props (e.g. `ui`, `title`, `description`) from pages like `/builder` to dial in per-project styling.
- The computed `workbenchProps` defaults to an empty object, so existing apps continue working without adjustments.

## Implementation Examples
```ts
type ContentAdminWorkbenchProps = InstanceType<
  typeof ContentAdminWorkbenchComponent
>['$props']

const props = defineProps<{
  previewBaseUrl?: string | null
  initialPath?: string
  iframeTitle?: string
  workbench?: Partial<ContentAdminWorkbenchProps>
}>()
```

```vue
<ContentAdminWorkbench
  class="inline-live-editor__workbench"
  v-bind="workbenchProps"
  :initial-path="initialPath"
  :auto-select-first="false"
  @page-selected="handlePageSelected"
  @document-change="handleDocumentChange"
/>
```
