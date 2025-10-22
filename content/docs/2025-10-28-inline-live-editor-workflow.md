# Inline Live Editor Workflow

## Initial Prompt
```
Implement the specs in layers/content/docs/inline_live_editor.md. Proceed step by step with each section and mark that in the spec document as it's done to be used as reference when resuming work at a future time. 
Ask me for anything that after evalulation, you are not so sure what decision to make. Strive for minimal impact on other areas of the applicaiton. Any time your confidence for taking an actions is < 80%, ask for clarification. Present implementation plan before proceeding on my instructions.
```

## Implementation Summary
Delivered a reusable inline editor shell that pairs `ContentAdminWorkbench` with a live preview iframe, emits debounced document updates, and adds a `useContentLiveUpdates` composable plus store helpers so consuming apps can live-render edits before persisting to CouchDB.

## Documentation Overview
- `app/components/inline/InlineLiveEditor.vue` orchestrates the two-pane layout, normalises paths, and posts `live_updates` messages containing the current minimal document to the embedded preview.
- `app/components/builder/Workbench.vue` now emits debounced `document-change` events, which `ContentAdminWorkbench` re-emits while tracking unsaved state and honouring an `initialPath` hint for first selection.
- `app/composables/useContentLiveUpdates.ts` installs a message listener that feeds updates into the Pinia store via the new `applyLiveDocument` action, ensuring cached summaries refresh without hitting the API.
- The inline editor depends on `useRuntimeConfig().public.siteUrl` when provided, but gracefully falls back to the current origin for local development.

## Implementation Examples
```vue
<!-- apps/bitvocation-demo/pages/builder.vue -->
<template>
  <InlineLiveEditor
    :preview-base-url="previewBaseUrl"
    initial-path="/"
    iframe-title="Bitvocation live preview"
  />
</template>
```

```ts
// layers/content/app/composables/useContentLiveUpdates.ts
const handleMessage = (event: MessageEvent) => {
  if (!isLiveUpdateMessage(event.data)) return
  const { path, document } = event.data.payload
  contentStore.applyLiveDocument(document)
}
```
