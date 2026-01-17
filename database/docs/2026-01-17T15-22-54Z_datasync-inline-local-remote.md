## Initial Prompt
Make them compact on one line

## Implementation Summary
Implementation Summary: Collapsed the local/remote value stacks into single-line rows using inline flex layouts for docs, file size, and update sequence cells.

## Documentation Overview
- Local/remote comparisons now render inline in each table cell for a more compact view.

## Implementation Examples
```vue
<div class="flex items-center gap-3">
  <span class="inline-flex items-center">...</span>
  <span class="inline-flex items-center">...</span>
</div>
```
