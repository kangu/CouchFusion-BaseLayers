# Inline Preview Hydration Fix

## Initial Prompt
```
Investigate why rendering the localhost:3011/builder page produces this hydration error: runtime-core.esm-bundler.js?v=7758558f:50 [Vue warn]: Hydration node mismatch:
- rendered on server: <div class="inline-live-editor__preview-placeholder" data-v-d9c024a4>…</div>  
- expected on client: iframe 
  at <InlineLiveEditor preview-base-url="http://localhost:3011" initial-path="/" iframe-title="Bitvocation live preview" > 
  at <Builder onVnodeUnmounted=fn<onVnodeUnmounted> ref=Ref< undefined > > 
  at <RouteProvider key="/builder" vnode= {__v_isVNode: true, __v_skip: true, type: {…}, props: {…}, key: null, …} route= {fullPath: '/builder', hash: '', query: {…}, name: 'builder', path: '/builder', …}  ... > 
  at <BaseTransition onAfterLeave= [ƒ] mode="out-in" appear=false  ... > 
  at <Transition onAfterLeave= [ƒ] name="page" mode="out-in" > 
  at <RouterView name=undefined route=undefined > 
  at <NuxtPage > 
  at <NuxtLayoutProvider layoutProps= {ref: RefImpl} key=undefined name=false  ... > 
  at <NuxtLayout > 
  at <App key=4 > 
  at <NuxtRoot>. Use the playwright mcp server to debug the console logs and iterate until you manage to fix this hydration error
```

## Implementation Summary
Resolved the builder hydration mismatch by deferring the inline preview iframe until after client mount and reusing shared base URL resolution, keeping SSR and client renders in sync.

## Documentation Overview
- Delay rendering of the inline preview iframe until the client finishes hydrating to ensure the server placeholder and client markup stay identical during SSR.
- Reordered `resolveBaseCandidates()` so it reuses any provided preview URL or configured `public.siteUrl` even when running server-side, falling back to the browser origin only on the client.
- Preserve the existing live-update workflow: once the iframe reports ready on the client, the latest in-memory document is streamed immediately.

## Implementation Examples
```ts
const resolveBaseCandidates = () => {
  if (typeof props.previewBaseUrl === "string" && props.previewBaseUrl.trim()) {
    return props.previewBaseUrl.trim()
  }
  const configUrl = runtimeConfig.public?.siteUrl || runtimeConfig.public?.siteURL
  if (typeof configUrl === "string" && configUrl.trim()) {
    return configUrl.trim()
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin
  }
  return ""
}
```

```vue
<template>
  <div class="inline-live-editor__preview-frame">
    <iframe
      v-if="isClientReady && previewUrl"
      ref="iframeRef"
      :src="previewUrl"
      :title="iframeTitle || 'Inline preview'"
      @load="handleIframeLoad"
    />
    <div v-else class="inline-live-editor__preview-placeholder">
      Unable to determine preview URL. Configure `public.siteUrl`
      or pass `preview-base-url`.
    </div>
  </div>
</template>
```
