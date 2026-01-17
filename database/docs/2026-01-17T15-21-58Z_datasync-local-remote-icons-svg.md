## Initial Prompt
Use some small svg icons for "local" and "remote"

## Implementation Summary
Implementation Summary: Replaced the local/remote dot markers with compact inline SVG icons labelled for Local and Remote.

## Documentation Overview
- Doc count and update sequence rows now use small SVG badges to distinguish local vs remote values.

## Implementation Examples
```vue
<svg class="mr-1 h-3 w-3 text-gray-400" viewBox="0 0 12 12" fill="currentColor">
  <circle cx="6" cy="6" r="5" />
  <path d="M4.6 3.8h1v4.4H4.6zM4.6 8.2h2.8v1H4.6z" fill="#ffffff" />
</svg>
```
