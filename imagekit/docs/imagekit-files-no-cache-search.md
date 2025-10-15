# ImageKit Files No Cache Search

## Initial Prompt
The /api/imagekit/files returns a cached version currently. Make sure to remove the cache headers from it. Also, the search functionality returns {"success":false,"error":"Unknown ImageKit error"}, check to see why that is happening and provide a fix

## Implementation Summary
ImageKit file listings now send no-cache headers and rebuild keyword queries with a graceful fallback so the admin picker always shows fresh results and functional search responses.

## Documentation Overview
- Added cache-busting headers to the Bitvocation `/api/imagekit/files` bridge so ImageKit responses are never cached between requests.
- `layers/imagekit/utils/imagekit.ts` now formats Lucene-friendly search expressions, escapes reserved characters, and falls back to in-memory filtering when ImageKit rejects the query format.
- Enhanced error parsing reveals upstream ImageKit error messages, simplifying debugging during new query experiments.

## Implementation Examples
```ts
const rawSearch = typeof options.searchQuery === 'string' ? options.searchQuery.trim() : ''
const searchQuery = this.buildSearchQuery(rawSearch)
const keywords = rawSearch ? this.tokenizeKeywords(rawSearch) : []
```

```ts
const fallbackFiles = await this.client.listFiles(baseOptions)
const filtered = this.filterFilesByKeywords(fallbackFiles as ImageKitFile[], keywords)
return {
  success: true,
  data: filtered.slice(0, limit),
}
```

```ts
private buildSearchQuery(term: string): string | null {
  if (!term) {
    return null
  }
  if (this.isAdvancedQuery(term)) {
    return term
  }
  const sanitized = this.sanitizeSearchTerm(term)
  if (!sanitized) {
    return null
  }
  const wildcardTerm = this.escapeLucene(sanitized).replace(/\s+/g, '*')
  const escapedPhrase = this.escapeLucene(sanitized)
  return `(name:*${wildcardTerm}* OR filePath:*${wildcardTerm}* OR tags:"${escapedPhrase}")`
}
```
