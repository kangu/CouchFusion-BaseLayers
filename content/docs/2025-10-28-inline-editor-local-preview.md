# Inline Editor Local Preview

## Initial Prompt
```
The content is still not passed to the iframe correctly, now I get this error: Workbench.vue:21 Structured clone failed in Workbench, falling back to JSON clone: DataCloneError: Failed to execute 'structuredClone' on 'Window': #<Object> could not be cloned.
    at cloneDocument (Workbench.vue:19:14)
    at Workbench.vue:529:22. Log out what is sent to the iframe and then debug what the problem is on parsing it through the useContentLiveUpdates composable. Use the MCP playwright server to test back and forth different changes until it is working and the new content is live-loaded onto the site page.
```

## Implementation Summary
Updated the inline editor to default the preview iframe to the current dev origin (instead of the production `siteUrl`) and added tracing around the postMessage pipeline, allowing live updates to land in the iframe and flow through `useContentLiveUpdates` without cross-origin issues.

## Documentation Overview
- `InlineLiveEditor` now skips rendering the iframe during SSR and always resolves the preview base URL from `window.location.origin` on the client, ensuring the embedded page matches the running dev instance.
- Logging hooks emit the outgoing payload and receipt (`[inline-live-editor]`, `[content-live-updates]`), helping future debugging.
- The fallback still honours production overrides by passing `previewBaseUrl` explicitly when needed.

## Implementation Examples
```ts
if (typeof window === 'undefined') {
  return ''
}
return window.location.origin
```

```ts
useContentLiveUpdates()
// console output:
// [content-live-updates] applying document { path, document }
// [content-live-updates] document applied { path, summary }
```
