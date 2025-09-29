The page type document looks currently like this:

```json
{
  "_id": "content/yo",
  "title": "Page title",
  "layout": {
    "spacing": "none"
  },
  "body": {
    "type": "minimal",
    "value": [
      "Hello",
      [
        "hero-section",
        {
          "title": "[in the body.value is where the main content array is dumped]"
        }
      ]
    ]
  },
  "path": "/yo",
  "seo": {
    "title": "Page title",
    "description": "SEO description."
  },
  "stem": "yo"
}
```

Refactor the pages.ts store to support this exact document structure.

## Progress Checklist
- [x] pages.ts store normalizes documents to the shown structure
- [x] Derived summary fields align with the refactored structure
- [x] Related documentation / implementation log added
- [x] Builder save workflow persists full documents via content API
- [x] Admin UI surfaces document metadata (e.g., last updated)
