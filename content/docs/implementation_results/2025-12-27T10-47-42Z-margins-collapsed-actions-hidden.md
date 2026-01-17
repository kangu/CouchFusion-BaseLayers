# Margins Collapsed Actions Hidden

## Initial Prompt
The Responsive overrides
and Reset buttons should also be hidden when the element is collapsed

## Implementation Summary
- Hid the margins action buttons (Responsive overrides/Reset) when the margins section is collapsed in `NodeMarginsPanel.vue`.
- Updated the margins spec checklist to record the collapsed action behavior.

## Documentation Overview
- The margins header now only shows the action buttons when the section is expanded, keeping the collapsed state minimal.
- The spec checklist reflects the new requirement for hidden actions when collapsed.

## Implementation Examples
```vue
<div v-if="expanded" class="node-panel__margins-actions">
    <button
        type="button"
        class="node-panel__margins-toggle"
        @click="toggleResponsiveMargins"
    >
        {{
            showResponsiveMargins
                ? "Hide responsive"
                : "Responsive overrides"
        }}
    </button>
    <button
        type="button"
        class="node-panel__margins-reset"
        @click="resetMargins"
    >
        Reset
    </button>
</div>
```
