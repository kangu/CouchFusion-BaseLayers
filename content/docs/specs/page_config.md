Update the builder component to handle page configuration by using this template as the
basis for the current fields

_Status (2025-09-25): ✅ `/builder` now captures path, title, SEO, navigation, and derives id/stem using this template for serialization._

```json
{
  "id": "content/${page_url}",
  "title": "Page title",
  "body": {
    "type": "minimal",
    "value": [] // replace with serialized output of nodes
  },
  "extension": "md",
  "meta": {},
  "navigation": true,
  "path": "${page_url}",
  "seo": {
    "title": "SEO title",
    "description": "SEO description."
  },
  "stem": "index"
}

```
