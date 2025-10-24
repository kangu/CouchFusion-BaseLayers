# Live Update Debounce

## Initial Prompt
```
Currently the changes from the builder are propagated on input blur. I want to change that so they happen on the @input event, but with a debounce of 0.5s.
```

## Implementation Summary
Added per-prop debounce scheduling in `NodeEditor` so text/number fields emit live updates on `@input` with a 500 ms delay, flushing immediately on blur to keep the inline preview responsive without spamming saves.

## Documentation Overview
- Introduced shared helpers (`schedulePropUpdate`, `flushPropUpdate`) with timer cleanup on unmount, ensuring only textual edits are throttled while booleans/selects remain immediate.
- Updated default text inputs, extra props, and textarea handling to trigger the new debounce logic while retaining blur flush behaviour.

## Implementation Examples
```vue
<input
  v-model="propDraft[prop.key]"
  @input="() => schedulePropUpdate(prop.key, propDraft[prop.key], prop.type)"
  @blur="() => flushPropUpdate(prop.key, propDraft[prop.key], prop.type)"
/>
```
