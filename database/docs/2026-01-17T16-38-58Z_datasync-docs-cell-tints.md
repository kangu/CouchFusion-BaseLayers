## Initial Prompt
Use lighter color tones for all colors. Keep the background only on the Docs column

## Implementation Summary
Implementation Summary: Softened the status tint colors and scoped the background highlights to the Docs column only.

## Documentation Overview
- Docs column now carries the status tint with lighter opacity, while other columns remain uncolored.

## Implementation Examples
```vue
<td :class="getDocsCellStatusClass(db)">...</td>
```
