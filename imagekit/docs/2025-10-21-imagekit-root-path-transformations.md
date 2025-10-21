# ImageKit Root Path Transformations

## Initial Prompt
Check to see why URLs like https://ik.imagekit.io/bitvocation/content-editor/nicehash_adoption_panel_KYuH240r0.jpeg?updatedAt=1760699549830 are not recognized the the imagekit directive to be complemeted by url transformations.

## Implementation Summary
Implementation Summary: Root-relative ImageKit URLs now resolve against the configured endpoint before transformation injection, ensuring the `v-imagekit` directive applies transformations even when the stored path includes query parameters.

## Documentation Overview
- Introduced an internal helper that rewrites ImageKit paths to absolute URLs using the configured endpoint before any transformation logic executes.
- Updated both `withImageKitTransformations` and `resolveImageKitUrl` to rely on the helper, so server and client consumers share the same root-path handling semantics.
- Preserved graceful fallbacks when no endpoint is available, keeping existing non-ImageKit usage unaffected.

## Implementation Examples
```ts
withImageKitTransformations('/content-editor/example.jpeg?updatedAt=123', {
  transformations: 'w-400',
  endpoint: 'https://ik.imagekit.io/bitvocation'
})
// => https://ik.imagekit.io/bitvocation/tr:w-400/content-editor/example.jpeg?updatedAt=123

resolveImageKitUrl('/content-editor/example.jpeg?updatedAt=123', 'https://ik.imagekit.io/bitvocation')
// => https://ik.imagekit.io/bitvocation/content-editor/example.jpeg?updatedAt=123
```
