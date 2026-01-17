## Initial Prompt
When the modal is open, lock the scroll position for the body behind it. Re-enable scroll on modal close. Keep a slight border with shadow around the element so users can see it opens above the previous page.

## Implementation Summary
Implementation Summary: Added body scroll locking for the compare dialog lifecycle and wrapped the modal content in a bordered, shadowed container.

## Documentation Overview
- The compare dialog now freezes background scrolling and restores it on close.
- The modal uses an inner border + shadow to visually float above the page.

## Implementation Examples
```ts
document.body.style.overflow = 'hidden'
```
