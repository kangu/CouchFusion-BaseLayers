# ImageKit Source Classification

## Initial Prompt
Now when I have URL links like /images/logos/strike.png (pointing to a local path on the server), the paths are redirectly incorrectly to imagekit. Make them work both at the same time, paths starting with / going to local while paths starting with https://ik.imagekit.io going to imagekit, while preserving the functionality to have embedded base64 images inside the src. It looks like the imagekit transform is added correctly on the initial page load of the site, but if it's coming in from a client navigation, then the transforms are not applied. Consider the possibility of integrating the v-lazy directive functionality inside v-imagekit to avoid race conditions.

## Implementation Summary
Implementation Summary: ImageKit source classification now keeps local assets intact while the lazy directive records resolved URLs, ensuring transformations survive both SSR and client navigation.

## Documentation Overview
- Added source classification helpers in `layers/imagekit/utils/transform.ts` so ImageKit transformations only apply to ImageKit-hosted assets, leaving local `/images/...` paths and data/blob URLs untouched.
- Updated URL resolution to convert ImageKit-relative paths into absolute URLs via the configured endpoint while returning local paths unchanged, keeping both rendering strategies functional.
- Coordinated with the Bitvocation lazy directive so ImageKit can reliably read the computed target source after client-side navigations, eliminating ordering race conditions.

## Implementation Examples
```ts
resolveImageKitUrl('/images/logos/strike.png', 'https://ik.imagekit.io/bitvocation')
// => '/images/logos/strike.png'

resolveImageKitUrl('/content-editor/banner.png?updatedAt=123', 'https://ik.imagekit.io/bitvocation')
// => 'https://ik.imagekit.io/bitvocation/content-editor/banner.png?updatedAt=123'

withImageKitTransformations('https://ik.imagekit.io/bitvocation/content-editor/banner.png', {
  transformations: ['w-512', 'q-80'],
  endpoint: 'https://ik.imagekit.io/bitvocation'
})
// => 'https://ik.imagekit.io/bitvocation/tr:w-512,q-80/content-editor/banner.png'
```
