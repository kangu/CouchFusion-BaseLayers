# World map: click-to-filter when zoomed

## Initial prompt
"How could we add back a click-to-filter for countries without interfering with the current zoom process which I like?" → approved: world view click zooms; zoomed-in click on a visiting country filters, any other click zooms out.

## Plan followed
1. `WorldMap.vue` `onClick`: when zoomed, a country with visitors under the pointer adds a country filter; otherwise zoom out.
2. Cues: pointer cursor and a "Click to filter" line in the tooltip over filterable countries; zoom-out cursor elsewhere.
3. Added a "← World" button in the map corner while zoomed, for dense regions with little empty space. Esc and the World chip still zoom out.
4. Footer hint and docs updated.

## Summary
- Verified in a browser with temporary sample data (removed afterwards):
  - world click zooms into Europe
  - hovering Germany shows the pointer cursor and "Click to filter"
  - clicking Germany adds "Country is Germany" and stays zoomed
  - clicking empty space zooms out
- World-view behaviour is unchanged.

## Next steps
- None required.
