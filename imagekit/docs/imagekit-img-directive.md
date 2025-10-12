# ImageKit `<img>` Directive Helper

## Initial Prompt
Implement the specs in layers/imagekit/docs/img_tag_helper.md. Proceed step by step with each section and mark that in the spec document as it's done to be used as reference when resuming work at a future time.

## Implementation Summary
Implementation Summary: Added ImageKit URL transformation helpers, registered a global `v-imagekit` directive, and wired the bitvocation lazy loader to honour those transformations.

## Documentation Overview
- Introduced `layers/imagekit/utils/transform.ts` to normalise relative ImageKit paths, compose transformation strings, and build transformed URLs while stripping prior `tr:` segments.
- Registered `v-imagekit` via `layers/imagekit/plugins/imagekit-directive.ts`, exposing SSR metadata, storing per-element transform hints, and dispatching change events so lazy loaders can recompute targets.
- Updated `apps/bitvocation-demo/plugins/lazy.ts` to resolve relative ImageKit paths against runtime config and reinitialise observers when transformation metadata changes.
- Marked the spec checklist in `layers/imagekit/docs/img_tag_helper.md` to reflect completed sections.

## Implementation Examples
- Apply transformations in markup:
  ```vue
  <img
    v-imagekit="['w-400', 'h-400']"
    v-lazy="member.image"
    :alt="member.name"
  />
  ```
- Compute transformed URLs programmatically:
  ```ts
  import { withImageKitTransformations } from '#imagekit/utils/transform'

  const src = withImageKitTransformations('/content-editor/avatar.jpg', {
    transformations: 'w-320,h-320',
    endpoint: runtimeConfig.public.imagekit.urlEndpoint,
  })
  ```
