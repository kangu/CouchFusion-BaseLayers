## Initial Prompt
```
Persist the position of the draggable handle split between the two panels to localStorage and restore is on builder page startup
```

## Implementation Summary
Implementation Summary: Sidebar width now persists across builder sessions by storing the draggable splitter position in `localStorage` and restoring it on load.

## Documentation Overview
- Loading logic retrieves the last saved width (clamped to safe bounds) before activating the layout, falling back gracefully if storage is unavailable.
- Width updates are watched and written back to storage whenever the divider moves or the viewport constraints shrink the grid.
- Persistence stays client-only and logs non-fatal warnings when storage access fails, preventing SSR or privacy issues.

## Implementation Examples
```ts
const stored = loadStoredSidebarWidth()
if (stored !== null) {
  sidebarWidth.value = stored
}
```
```ts
watch(() => sidebarWidth.value, (value, previous) => {
  if (value !== previous) {
    persistSidebarWidth(value)
  }
})
```
