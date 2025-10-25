## Initial Prompt
```
Also guard the builder from losing changes when navigating between previous history states
```

## Implementation Summary
Implementation Summary: History selection now checks for unsaved edits before swapping revisions, confirming with the user and resetting state only when it’s safe.

## Documentation Overview
- Intercepts history-button and dropdown selections, prompting to discard unsaved work before loading another revision.
- Resets the builder’s bootstrap flags so the newly loaded history document initializes cleanly without carrying over dirty state.
- Shares the same confirmation flow as page switches, keeping the experience consistent across navigation surfaces.

## Implementation Examples
```ts
if (hasUnsavedChanges.value) {
  const confirmed = await confirmDiscardUnsavedChanges()
  if (!confirmed) {
    return
  }
  updateUnsavedState(false)
}
```
```ts
if (!targetId) {
  selectedHistoryId.value = null
  return
}
await contentStore.fetchHistory(selectedSummary.value.path)
selectedHistoryId.value = targetId
```
