# DOMPurify Browser Fallback

## Initial Prompt
```
Looks like there's a require import here as well: browser.js?v=06371648:1 Uncaught (in promise) ReferenceError: require is not defined
    at browser.js?v=06371648:1:39
```

## Implementation Summary
Removed `isomorphic-dompurify`, adopted the browser-friendly `dompurify` package, and updated the shared helper to instantiate only when `window` exists (falling back to passthrough on SSR) so the editor no longer pulls Node-only `require` paths.

## Documentation Overview
- `layers/content/package.json` now depends on `dompurify` instead of `isomorphic-dompurify`.
- `layers/content/app/utils/rich-text.ts` lazily creates a DOMPurify instance in the browser, applies the shared allowlist/anchor hooks, and simply returns the stored value during SSR since admin content is sanitized before persistence.
- `layers/content/docs/specs/rich_text_editors.md` and the main integration doc reference this client-side sanitization strategy.

## Implementation Examples
```ts
import createDOMPurify from 'dompurify'

let domPurify: ReturnType<typeof createDOMPurify> | null = null

const getDomPurify = () => {
  if (typeof window === 'undefined') return null
  if (!domPurify) {
    domPurify = createDOMPurify(window as unknown as Window)
    domPurify.setConfig?.(DOMPURIFY_CONFIG)
  }
  return domPurify
}

export const sanitizeRichTextHtml = (input?: string | null) => {
  if (!input) return ''
  return getDomPurify()?.sanitize(input, DOMPURIFY_CONFIG) ?? input
}
```
