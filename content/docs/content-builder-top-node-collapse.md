# Content Builder Top Node Collapse

## Initial Prompt
In the content builder, update all top level nodes to start in a collapsed stated with the ability to expand. Included in the "collapsed" state should be the title, description and "Remove" links (plus the new Expand)

## Implementation Summary
NodeEditor now collapses component panels by default, exposing only the header (title, description, actions) until the user expands the section.

## Documentation Overview
- Added per-node collapsed state tied to each component instance, initialised on hydration and toggled via a styled header button.
- Node body sections (props, arrays, children) are wrapped in `v-show` so they remain interactive once expanded without re-rendering from scratch.
- Array toolbars, checkboxes, and collapsible controls share a cohesive styling aligned with existing builder buttons.

## Implementation Examples
- `layers/content/app/components/builder/NodeEditor.vue:1` – header now embeds a collapse toggle and only renders the body when expanded.
- `layers/content/app/components/builder/NodeEditor.vue:334` – per-node collapsed state managed alongside array collapse logic.
- `layers/content/app/components/builder/NodeEditor.vue:1008` – CSS styling provides matching hover/focus states for the collapse button.
