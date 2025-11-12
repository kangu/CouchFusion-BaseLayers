# DOMPurify Import Fix

## Initial Prompt
```
rich-text.ts:1 Uncaught (in promise) SyntaxError: The requested module '/_nuxt/@fs/Users/radu/Projects/nuxt-apps/apps/bitvocation/node_modules/isomorphic-dompurify/browser.js?v=06371648' does not provide an export named 'default' (at rich-text.ts:1:8)
```

## Implementation Summary
Updated the rich-text helper to import `isomorphic-dompurify` as a namespace so Vite doesn’t expect a default export from the package’s browser entry, preventing the runtime SyntaxError.

## Documentation Overview
- `layers/content/app/utils/rich-text.ts` now uses `import * as createDOMPurifyModule` before resolving the factory, keeping the rest of the DOMPurify wiring untouched.
- This keeps compatibility with both CommonJS and ESM builds of `isomorphic-dompurify`, ensuring the shared sanitizer works across apps consuming the content layer.

## Implementation Examples
```ts
import * as createDOMPurifyModule from 'isomorphic-dompurify'

const DOMPurify = resolveDomPurify(createDOMPurifyModule)
```
