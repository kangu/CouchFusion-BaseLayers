# DOMPurify Rich Text Sanitizer Migration

## Initial Prompt
```
sanitize-html seems to use const htmlparser = require('htmlparser2'); and then i get this error in the console: Uncaught (in promise) ReferenceError: require is not defined
    at index.js?v=a9d78320:1:20. Evaluate maybe other options
```

## Implementation Summary
Replaced `sanitize-html` with `isomorphic-dompurify`, updated the shared rich-text helper to configure DOMPurify hooks (anchor rel/target), refreshed docs, and recorded the dependency change so Nuxt/Vite no longer hits CommonJS `require` errors in the browser.

## Documentation Overview
- `layers/content/package.json` now depends on `isomorphic-dompurify` instead of `sanitize-html`, keeping the Tiptap dependencies unchanged.
- `layers/content/app/utils/rich-text.ts` instantiates DOMPurify via the isomorphic wrapper, configures allowlists, and exposes `sanitizeRichTextHtml` with consistent anchor sanitization and SSR support.
- `layers/content/docs/specs/rich_text_editors.md` + `layers/content/docs/2025-11-12T08-39-23Z_rich-text-editor-integration.md` mention the DOMPurify-based pipeline so future contributors know which sanitizer is in play.

## Implementation Examples
```ts
import createDOMPurify from 'isomorphic-dompurify'

const DOMPurify = createDOMPurify()
DOMPurify.setConfig({
  ALLOWED_TAGS: RICH_TEXT_ALLOWED_TAGS,
  ALLOWED_ATTR: RICH_TEXT_ALLOWED_ATTRIBUTES
})
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

export const sanitizeRichTextHtml = (input?: string | null) =>
  input ? DOMPurify.sanitize(input) : ''
```
