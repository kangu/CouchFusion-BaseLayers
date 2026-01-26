## Initial Prompt
Scan the bitvocation slug component for socialImageMeta and migrate that into couchfusioncom. Extract the functionality into a content layer composable for minimal surface in the implementing slug vue file.

## Plan
1. Add a reusable composable in the content layer that composes page head/meta (including social image tags) from a `pageDocument` ref with configurable defaults.
2. Switch the couchfusioncom catch-all page to the composable, replacing inline head/meta and social image wiring.
3. Document the change for downstream apps.

## Implementation Summary
- Introduced `useContentPageMeta`, which reads the current page document, merges brand defaults, and appends social image tags via `useSocialImageMeta`.
- Couchfusioncom’s catch-all page now imports the composable and drops its inline meta generation, reducing surface while keeping live updates intact.

## Next Steps
- Encourage other apps to use `useContentPageMeta` to standardize social meta handling.
- Optionally add tests to assert OG/Twitter meta tags render when `seo.image` is provided.
