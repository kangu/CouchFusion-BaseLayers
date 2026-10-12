# World map: centering and continent zoom

## Initial prompt
"I expect the map to be centered on larger resolutions. Is it rather easy to do a quick zoom-in by clicking on one of the continents, and see a more detailed view of that continent, then clicking again would zoom out to the entire world."

## Plan followed
1. Centering: the map/list pair is a centered flex row; the map is capped at 1040px. Previously an empty 230px list column pushed the map left when there was no data.
2. Zoom: `WorldMap.vue` now draws through a view transform (center + scale) and animates between the world and a continent box (520 ms, skipped with reduced motion).
3. Detail: the generator also writes `world-dots-fine.ts` (312 x 180, 17,399 dots, 39 KB), lazy-loaded on first hover/zoom and used above 1.5x scale.
4. Continents: `WORLD_REGIONS` (view box + member countries) is generated from `world-countries`; the clicked continent prefers the hovered country's own, else the smallest box containing the pointer (so Siberia opens Asia).
5. Controls: click the map or a continent chip to zoom in; click again, press Esc, or use the World chip to zoom out. While zoomed, the side list and summary are scoped to that continent.

## Summary
- Behaviour change: clicking the map no longer filters by country; the side list and the Countries table do.
- Verified in a browser with temporary sample data (removed afterwards):
  - equal margins at 1680px
  - zoom into Europe, North America and Asia
  - zoom out by click, Esc and the World chip
  - scoped list and summary

## Next steps
- None required.
