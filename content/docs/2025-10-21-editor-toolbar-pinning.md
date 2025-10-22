# Editor Toolbar Pinning

## Initial Prompt
On the content editor layer, when working with editing a page, the toolbar with Save Changes button doesn't properly stay anchored to the top while scrolling down. It was working before, but since the component was extracted from the bitvocation-demo into the content layer directly, it seems to have been broken. Investigate how to fix this and propose a solution.

## Implementation Summary
Implementation Summary: Restored the fixed-position save toolbar by capturing card offsets in the observer logic so the header stays anchored while scrolling.

## Documentation Overview
- Reintroduced fixed positioning for `content-admin-workbench__editor-header.is-pinned` so it detaches from flow when the sentinel leaves view.
- `updateHeaderMeasurements` now stores top/left/width offsets from the editor card, feeding them into inline styles returned by `headerFixedStyles`.
- The spacer element continues to preserve layout height, preventing jumps as the toolbar toggles between static and fixed states.

## Implementation Examples
```ts
headerPosition.top = cardRect ? `${cardRect.top}px` : '0px'
headerPosition.left = `${referenceRect.left}px`
headerPosition.width = `${referenceRect.width}px`

return {
  top: headerPosition.top,
  left: headerPosition.left,
  width: headerPosition.width
}
```
