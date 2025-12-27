# Margins Collapsed

## Initial Prompt
Implement the specs in content/docs/specs/margins_collapsed.md. Proceed step by step with each section and mark that in the spec document as it's done to be used as reference when resuming work at a future time.
Ask me for anything that after evalulation, you are not so sure what decision to make. Strive for minimal impact on other areas of the applicaiton. Any time your confidence for taking an actions is < 98%, ask for clarification. Present implementation plan before proceeding on my instructions.

## Implementation Summary
- Collapsed the margins controls by default and added a double-arrow toggle on the “Margins” label within `NodeMarginsPanel.vue`.
- Highlighted the “Margins” label whenever any base or responsive margin value is set by computing a `hasMargins` flag from the draft state.
- Updated NodeEditor scoped styles to support the new margins header button and chevron state while keeping existing class names.
- Marked the spec checklist complete.

## Documentation Overview
- The margins panel now renders only the label row by default; clicking the label toggles the controls.
- If any margin value is non-zero (base or responsive), the label is visually highlighted and the panel auto-expands.
- Styles remain centralized in `NodeEditor.vue` with `:deep()` selectors for the new header/button elements.

## Implementation Examples
```vue
<button
    type="button"
    class="node-panel__margins-title"
    :class="{ 'is-active': hasMargins }"
    @click="toggleExpanded"
>
    <span>Margins</span>
    <span
        class="node-panel__margins-chevron"
        :data-state="expanded ? 'expanded' : 'collapsed'"
        aria-hidden="true"
    >
        ⌄⌄
    </span>
</button>
```

```ts
const hasMargins = computed(() => {
    for (const side of Object.values(props.marginDraft)) {
        for (const value of Object.values(side)) {
            if (String(value) !== "0") {
                return true;
            }
        }
    }
    return false;
});
```
