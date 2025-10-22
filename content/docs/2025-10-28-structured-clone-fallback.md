# Structured Clone Fallback

## Initial Prompt
```
When the content builder tries to send data over to the iframe, the underlying site returns this error: Failed to emit document change DataCloneError: Failed to execute 'structuredClone' on 'Window': #<Object> could not be cloned.
    at cloneDocument (Workbench.vue:18:12)
    at Workbench.vue:525:22. Investigate and fix, the live content data should be successfully passed to the site.
```

## Implementation Summary
Wrapped the builder’s `structuredClone` usage in a try/catch so the workbench falls back to JSON cloning when the structured clone API rejects the document, allowing live updates to propagate to the iframe without DataCloneErrors.

## Documentation Overview
- `app/components/builder/Workbench.vue` now logs a warning when `structuredClone` fails and immediately retries using `JSON.parse(JSON.stringify(...))`, restoring the previous behaviour without breaking the live preview pipeline.

## Implementation Examples
```ts
if (typeof structuredClone === 'function') {
  try {
    return structuredClone(doc)
  } catch (error) {
    console.warn('Structured clone failed in Workbench, falling back to JSON clone:', error)
  }
}
return JSON.parse(JSON.stringify(doc))
```
