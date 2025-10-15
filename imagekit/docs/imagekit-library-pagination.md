# ImageKit Library Pagination

## Initial Prompt
Even though I have more items in the ImageKit folder, the Select Image dialog only shows 3 of them. If I search for something, it now works, so there are other files there, but they are not shown. Make sure to query the images in descending order by creation time, show a label for how many are displayed out of the total, and provide a button for "Show All"

## Implementation Summary
ImageKit list requests now enforce `DESC_CREATED` ordering, return total counts alongside files, and support a Show All fallback flow that keeps search stable even when the API rejects simple keywords.

## Documentation Overview
- `ImageKitListOptions` gained `sort`, and the service forwards it while defaulting to `DESC_CREATED`; total counts are read from `x-total-count` and shared with consumers.
- Failing Lucene searches fall back to a sorted list plus client-side keyword filtering, ensuring Show All can still surface the complete folder contents.
- The Nuxt ImageKit composable now returns `{ files, total }`, allowing UIs to display accurate “displayed vs total” labels.

## Implementation Examples
```ts
const files = await this.client.listFiles({
  ...baseOptions,
  searchQuery: searchQuery ?? undefined,
})

const total = this.extractTotalCount(files, data.length)
```

```ts
const result = await getImageList({
  limit: requestedLimit,
  searchQuery: searchTerm.value.trim() || undefined,
  path: folderHint.value,
  sort: 'DESC_CREATED',
})
```
