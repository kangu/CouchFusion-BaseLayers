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

## Plan
1. Reproduce the hydration warning via Playwright on `http://localhost:3011/builder` and capture the console output.  
2. Adjust `InlineLiveEditor` SSR/client rendering to eliminate the mismatch.  
3. Re-test with Playwright to confirm the fix and prepare documentation updates.

## Implementation Summary
Resolved the builder hydration mismatch by deferring the inline preview iframe until after client mount and reusing shared base URL resolution, keeping SSR and client renders in sync.

## Next Steps
1. Keep an eye on remaining console errors, especially the 404 history fetches, to ensure they do not mask new hydration issues.  
2. Verify additional inline-editor routes once they adopt the same preview strategy to confirm consistent behaviour.
