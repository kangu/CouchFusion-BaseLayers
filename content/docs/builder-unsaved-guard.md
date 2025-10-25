## Initial Prompt
```
Prevent navigating away from the page holding the content builder when its contents have been modified since the initial load and there hasn't been a save operation in between. Apply the same confirmation when triggering the load for the content of another page. The goal is for a user to not lose any kind of work he's been done on the page by navigating or loading something from accident
```

## Implementation Summary
Implementation Summary: Added unsaved-change safeguards to the shared content builder, prompting before cross-page loads, route leaves, or window unloads unless the latest edits have been saved.

## Documentation Overview
- Introduced an internal `hasUnsavedChanges` tracker inside `ContentAdminWorkbench`, emitting `unsaved-state-change` so hosts can react and resetting only after saves or confirmed discards.
- Wrapped `openPageForEditing` with a discard confirmation that fires whenever the requested path differs and pending edits exist, keeping new loads from clobbering work accidentally.
- Enhanced `InlineLiveEditor` to respect the unsaved signal: registering `beforeunload` guards, short-circuiting route leaves via `onBeforeRouteLeave`, and delegating page switches to in-place history updates without triggering Nuxt navigation.

## Implementation Examples
```ts
const confirmDiscardUnsavedChanges = async (): Promise<boolean> => {
  if (!hasUnsavedChanges.value) {
    return true
  }

  if (typeof window === 'undefined') {
    return true
  }

  return window.confirm('You have unsaved changes. Discard them and continue?')
}
```
```ts
onBeforeRouteLeave(() => {
  if (!hasUnsavedChanges.value) {
    return
  }

  if (typeof window !== 'undefined') {
    const shouldLeave = window.confirm('You have unsaved changes. Leave without saving?')
    if (!shouldLeave) {
      return false
    }
  }

  setUnsavedState(false)
})
```
