# Clone/Remove Icon Buttons

## Initial Prompt
Update the Clone and Remove buttons to have button styling like the Expand/Collapse one, but only include small icons, no text. Keep icon + text on expand/collapse button.

## Implementation Summary
Reworked builder clone/remove controls to reuse the primary toggle styling with icon-only buttons, providing consistent affordances while keeping expand/collapse text intact.

## Documentation Overview
- Updated `NodeEditor.vue` to replace textual Clone/Remove buttons with icon-only variants that reuse the toggle styling and expose accessible `aria-label`s.
- Added styling modifiers to support icon-only toggles, including dedicated colour treatments for clone (accent) and remove (danger) actions.
- Inline and admin workbenches inherit the new visuals automatically because they consume the shared `NodeEditor` component.

## Implementation Examples
- Component and text nodes now show compact icon buttons for clone (overlapping squares) and remove (trash can) next to the expand/collapse control.
- The expand/collapse button remains unchanged, keeping its text label while the other actions adopt icon-only affordances.
