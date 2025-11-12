# Rich Text Sanitizer Import Fix

## Initial Prompt
```
I get this error: 
﻿
rich-text.ts:1 Uncaught (in promise) SyntaxError: The requested module '/_nuxt/@fs/Users/radu/Projects/nuxt-apps/apps/bitvocation/node_modules/sanitize-html/index.js?v=a9d78320' does not provide an export named 'default' (at rich-text.ts:1:8)
```

## Implementation Summary
Patched `rich-text.ts` to resolve the `sanitize-html` CommonJS export at runtime, ensuring both default and named shapes work during Nuxt/Vite bundling so the rich text sanitizer loads without errors.

## Documentation Overview
- `layers/content/app/utils/rich-text.ts` now imports the module plus `IOptions`, then normalizes the export (preferring a function default but falling back to the module itself) before configuring sanitizer allowlists.
- Throwing a descriptive error if the module shape is unexpected keeps future debugging straightforward.
- No changes were required elsewhere; builder/runtime code keeps importing `sanitizeRichTextHtml` as before.

## Implementation Examples
```ts
import sanitizeHtmlModule, { type IOptions } from 'sanitize-html'

type SanitizeHtml = (input: string, options?: IOptions) => string

const resolveSanitizeHtml = (mod: unknown): SanitizeHtml => {
  if (typeof mod === 'function') return mod as SanitizeHtml
  if (mod && typeof (mod as Record<string, unknown>).default === 'function') {
    return (mod as { default: SanitizeHtml }).default
  }
  throw new Error('[content-layer] sanitize-html export missing')
}

const sanitizeHtml = resolveSanitizeHtml(sanitizeHtmlModule)
```
