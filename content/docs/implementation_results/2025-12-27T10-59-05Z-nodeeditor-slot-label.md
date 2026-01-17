# Nodeeditor Slot Label

## Initial Prompt
Refactor the node editor so that when there is a rendered slot and its title is "Template (Slot)", make it so instead of that, we show "${slotName} (Slot)", with "(Slot)" which a lighter shade of grey so it makes the user focus their attention on the name instead. Any time your confidence for taking an actions is < 98%, ask for clarification. Present implementation plan before proceeding on my instructions.

## Implementation Summary
- Updated `NodeEditor.vue` header to display `${slotName} (Slot)` when the component label is `Template (Slot)`, using "Unnamed slot" as the fallback.
- Added a `slotDisplayName` computed to derive the slot label from draft/props data for template nodes.
- Styled the `(Slot)` suffix with a lighter grey to de-emphasize it.

## Documentation Overview
- Slot template headers now show the slot name while keeping the `(Slot)` suffix subdued.
- The slot label is sourced from the current draft state, falling back to node props and then to "Unnamed slot" if missing.
- Header rendering falls back to the original label for all non-template components.

## Implementation Examples
```vue
<strong v-if="slotDisplayName">
    <span>{{ slotDisplayName }}</span>
    <span class="node-panel__slot-suffix">(Slot)</span>
</strong>
```

```ts
const slotDisplayName = computed(() => {
    if (props.node.type !== "component") {
        return null;
    }
    if (componentDef.value?.label !== "Template (Slot)") {
        return null;
    }
    const rawValue =
        propDraft.slot ??
        (props.node.props ? props.node.props["slot"] : undefined);
    const slotName = typeof rawValue === "string" ? rawValue.trim() : "";
    return slotName || "Unnamed slot";
});
```
