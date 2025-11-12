# Rich Text Sanitizer Import – Namespace Fix

## Initial Prompt
```
I still get the same error. I'm using  "sanitize-html": "^2.17.0",
```

## Implementation Summary
Switched the sanitizer helper to use a namespace import (`import * as sanitizeHtmlModule`) so Vite/Nuxt no longer expects a default export from `sanitize-html`, resolving the runtime SyntaxError while keeping the runtime detection guard intact.

## Documentation Overview
- `layers/content/app/utils/rich-text.ts` now imports the module namespace plus the `IOptions` type, then passes the object into `resolveSanitizeHtml`, which handles both function and `{ default: fn }` shapes.
- This accommodates projects pinning `sanitize-html@^2.17.0`, where the package’s CommonJS entry does not expose a default export when consumed via native ESM.
- No additional builder/runtime changes are required; consumers continue calling `sanitizeRichTextHtml`.

## Implementation Examples
```ts
import type { IOptions } from 'sanitize-html'
import * as sanitizeHtmlModule from 'sanitize-html'

const sanitizeHtml = resolveSanitizeHtml(sanitizeHtmlModule)
```
