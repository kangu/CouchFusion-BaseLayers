## Initial Prompt
The value from line 426 in datasync.vue represent a file size value. Refactor the ui with a local function that transforms the bytes value into appropriate KB/MB/GB

## Implementation Summary
Implementation Summary: Added a local byte-size formatter to the Data Sync UI and used it to display file sizes with human-readable KB/MB/GB units.

## Documentation Overview
- Data Sync table now formats the file size column using a `formatBytes` helper for clearer readability.

## Implementation Examples
```ts
const formatBytes = (value?: number): string => {
  if (typeof value !== 'number') return '-'
  if (value < 1024) return `${value} B`
  // ...KB/MB/GB
}
```
