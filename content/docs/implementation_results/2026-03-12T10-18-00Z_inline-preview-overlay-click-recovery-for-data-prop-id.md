# Inline preview overlay click recovery for data-prop-id

## Request
Reproduce clicking `.profile-picture` in inline preview and ensure the image selector opens in the node editor.

## Findings
- `Landing.vue` has nested markers:
  - `<picture class="profile-picture" data-prop-id="profileImage">`
  - `<img class="profile-image" data-prop-id="profileAltText">`
- The hero layout can route pointer targeting through overlaying elements (`.content-container`), so relying only on `event.target.closest('[data-prop-id]')` is brittle and may miss intended markers.

## Fix
Updated `layers/content/app/composables/useContentLiveUpdates.ts` click resolution:
1. Keep direct marker lookup from event target.
2. Add fallback marker discovery using `document.elementsFromPoint(event.clientX, event.clientY)`.
3. Choose a preferred marker:
   - if direct marker is an `IMG` with an ancestor marker, prefer ancestor marker (maps image clicks to image prop instead of alt text prop).

## Validation (Playwright)
On `http://localhost:7833/k`, clicking `.profile-picture` in iframe now yields:
- emitted payload: `propPath: "profileImage"` (not `profileAltText`)
- node editor focuses `profileImage`
- image library modal opens (`data-image-library` backdrop present)

## Notes
- This improves click robustness for occluded/stacked DOM regions and nested marker hierarchies, without changing component visuals.
