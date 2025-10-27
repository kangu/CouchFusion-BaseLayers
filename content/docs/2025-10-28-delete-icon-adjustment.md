# Delete Icon Adjustment

## Initial Prompt
The delete svg icon looks weird, fix it.

## Implementation Summary
Refined the remove button icon to a balanced trash glyph with explicit body and lid proportions so the inline builder controls render cleanly.

## Documentation Overview
- Replaced the trash can SVG path in `NodeEditor.vue` for both component and text node remove actions with a revised outline that better matches the button frame.
- The new icon keeps the same viewBox and styling hooks, so existing hover/focus treatments continue to work across admin and inline builder contexts.

## Implementation Examples
- Remove controls now display a centered trash can icon composed of a rectangular bin and lid (`M9 3v2…` path), eliminating the previous distorted appearance.
