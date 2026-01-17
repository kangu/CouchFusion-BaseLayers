## Initial Prompt
When clicking Compare Docs, I expect to see a dialog pop up with the contents from the Document comparison.

## Implementation Summary
Implementation Summary: Wired the compare dialog to use a dialog ref with showModal/close and switched to v-show so the modal reliably opens and preserves its contents.

## Documentation Overview
- The compare dialog now explicitly opens via `showModal()` and stays mounted while toggled.

## Implementation Examples
```ts
if (compareDialogRef.value && !compareDialogRef.value.open) {
  compareDialogRef.value.showModal()
}
```
