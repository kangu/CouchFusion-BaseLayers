# useSocialImageMeta — Social Image Meta Generation

## Purpose
`useSocialImageMeta` centralises generation of Open Graph and Twitter social image tags so consuming apps don’t hand-roll per-page logic. It normalises input URLs, applies ImageKit transforms when applicable, and returns a meta array ready to spread into `useHead`.

## Current Behaviour
- **Input:** `image` (MaybeRef string) plus optional `transforms` and `card`.
- **Normalisation:** Uses `normalizeSeoImage` to require non-empty absolute URLs.
- **ImageKit transforms:** If the host ends with `ik.imagekit.io`, rewrites the path to include the desired transform. Non-ImageKit URLs are passed through unchanged.
- **Defaults:** `og:image` → `w-1200,h-630,fo-auto`; `twitter:image` → `w-1200,h-628,fo-auto`; `twitter:card` → `summary_large_image`.
- **Output:** `socialImageMeta` computed array:
  - `{ property: 'og:image', content: <transformed-or-original> }`
  - `{ name: 'twitter:image', content: <transformed-or-original> }`
  - `{ name: 'twitter:card', content: 'summary_large_image' }`

### Usage
```ts
const { socialImageMeta } = useSocialImageMeta({
  image: computed(() => pageDocument.value?.seo.image),
  transforms: {
    og: 'w-1200,h-630,fo-auto',
    twitter: 'w-1200,h-628,fo-auto',
  },
  card: 'summary_large_image',
});

useHead(() => ({
  title: pageDocument.value?.seo.title ?? 'Site title',
  meta: [
    { name: 'description', content: pageDocument.value?.seo.description ?? '' },
    ...socialImageMeta.value,
  ],
}));
```

## Implementation Notes
- File: `layers/content/app/composables/useSocialImageMeta.ts`
- Uses `new URL()` parsing to safely manipulate ImageKit paths.
- Leaves existing `tr:` transforms intact by replacing or inserting the transform segment.

## Future Directions
- **Additional platforms:** add optional entries for Pinterest/LinkedIn with their preferred sizes; expose a `platforms` option to toggle outputs.
- **Format negotiation:** allow overriding format (e.g., `f-webp`) via transform tokens or a dedicated option.
- **Fallbacks:** optional placeholder image when `seo.image` is missing; warn in dev mode if no image is provided.
- **Caching:** memoize per-URL transform results to avoid repeated parsing in high-frequency head recomputations.
- **Validation:** optional flag to enforce HTTPS-only images and log/warn on non-absolute inputs. 
