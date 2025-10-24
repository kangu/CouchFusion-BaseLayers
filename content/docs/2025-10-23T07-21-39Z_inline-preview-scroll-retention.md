## Initial Prompt
```
After a live change from the Content Builder, the embedded iframe is refreshed and sometimes navigates to the top of the page. If I'm modifying something further down, it complicates things as it jumps and I need to scroll again. Implement a solution that handles this case, keeping the scroll position in place while the document re-renders with the new content.
```

## Implementation Summary
Implementation Summary: Hooked scroll preservation into `useContentLiveUpdates`, capturing the preview page offset before applying updates and retrying restoration across several frames until the position sticks.

## Documentation Overview
- Enhanced the live update composable to snapshot `scrollX/scrollY` whenever the incoming document targets the current path and loop restoration through `requestAnimationFrame` (with a brief timeout fallback) after the store update.
- Scoped the behavior to same-path updates so navigation changes still jump to the top as expected.

## Implementation Examples
```ts
if (currentPath === path) {
  const coords = { x: window.scrollX, y: window.scrollY }
  scheduleScrollRestore(coords) // retries until aligned
}
```
