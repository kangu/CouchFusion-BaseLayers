# Editor Toolbar Top Clamp

## Initial Prompt
If I scroll very slow, the toolbar get anchored to the correct top position of zero, but if I scroll very fast, it goes partially underneath the top part of the website. Make sure that the toolbar is never sitting on a top position lower than 0.

## Implementation Summary
Implementation Summary: Pinned toolbar styles now clamp the computed top offset to zero so fast scrolls can’t push it below the viewport edge.

## Documentation Overview
- Parsed the stored top offset inside `headerFixedStyles` and enforced a minimum value of zero before applying the inline style.
- Left existing width/left measurements untouched so alignment with the editor card is preserved.
- No other pinning logic changed, keeping resize and intersection observers intact.

## Implementation Examples
```ts
const parsedTop = Number.parseFloat(headerPosition.top)
const safeTop = Number.isFinite(parsedTop) ? Math.max(parsedTop, 0) : 0
return {
  top: `${safeTop}px`,
  left: headerPosition.left,
  width: headerPosition.width
}
```
