## Initial Prompt
```
Evaluate how to incorporate and use the /builder route from within the content layer itself so the file doesn't need to be created for every project. Refactor the route so it can accept extra parameters signifying the route to be edited. For example, navigating to /builder/about should start editing on the /about page. Navigating to /builder/about/me should edit /about/me. And nagivating to /builder or /builder/ should edit the / page.
```

## Implementation Summary
Implementation Summary: Introduced a shared content-layer builder route with catch-all editing, taught InlineLiveEditor to react to dynamic initial paths, and confirmed builder paths default to ignoring in content routing.

## Documentation Overview
- Added `pages/builder/[[...target]].vue` to the content layer so every consuming app inherits the inline editor route without duplicating page files.
- Registered the route programmatically via `utils/register-builder-page.ts`, ensuring the catch-all is available even when Nuxt's file scanning misses layer-provided pages.
- The shared builder reads optional catch-all segments from the route and passes the normalised path into `InlineLiveEditor`, ensuring `/builder/about/me` targets `/about/me`.
- Extended `InlineLiveEditor` to watch for `initialPath` updates, reset its internal state, and re-render the workbench so navigating between builder URLs swaps the active document seamlessly.
- Reserved `/builder` within `resolveIgnoredPrefixes` so sitemap generation and content middleware automatically skip the editorial surface.

## Implementation Examples
```vue
<!-- layers/content/app/pages/builder/[[...target]].vue -->
<InlineLiveEditor
  :preview-base-url="previewBaseUrl"
  :initial-path="initialPath"
  iframe-title="Content builder live preview"
/>
```
```ts
watch(
  () => initialPath.value,
  (nextPath, previousPath) => {
    if (!nextPath || nextPath === previousPath) {
      return
    }

    activePath.value = nextPath
    latestDocument.value = null
    selectedSummary.value = null
    isIframeReady.value = false
    workbenchInstanceKey.value += 1
  }
)
```
