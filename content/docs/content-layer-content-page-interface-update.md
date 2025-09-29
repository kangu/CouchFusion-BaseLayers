# Content Page Interface Update

## Initial Prompt
```
Update the content page interface to include the following fields {{
  path: '/',
  title: 'Page title',
  seoTitle: 'Page title',
  seoDescription: 'SEO description.',
  meta: {}
}}
```

## Implementation Summary
Extended content page APIs and store types to surface path, title, seoTitle, seoDescription, and meta fields for all fetched documents.

## Documentation Overview
- Server create/update handlers now accept `seoTitle`, `seoDescription`, and `meta`, persisting them alongside existing metadata (`layers/content/server/api/content/pages.post.ts`, `pages.put.ts`).
- The pages read endpoint includes the new fields when returning a single page or the index list, normalising legacy `metadata` values to `meta` (`layers/content/server/api/content/pages.get.ts`).
- `useContentPagesStore` exposes the enriched fields through `ContentPageSummary`/`ContentPageDocument`, now also normalising each document to the canonical minimal structure supplied by the content APIs (`layers/content/app/stores/pages.ts`).

## Implementation Examples
```ts
// Create a page with SEO fields via the store
const store = useContentPagesStore()
await store.createPage({
  path: '/about',
  title: 'About',
  seoTitle: 'About Our Team',
  seoDescription: 'Meet the team behind the product.',
  meta: { draft: false }
})

// Access the fields in a component
const { page } = useContentPage('/about')
console.log(page.value?.seoTitle) // -> 'About Our Team'
```
