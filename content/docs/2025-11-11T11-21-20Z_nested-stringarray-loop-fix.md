# Nested Stringarray Loop Fix

## Initial Prompt
Console shows recursive update errors after the latest nested stringarray work:
```
Uncaught (in promise) Maximum recursive updates exceeded in component <NodeEditor>...
openPageForEditing @ ContentAdminWorkbench.vue:510
...
```
The feature otherwise works, but the builder spams warnings each time the survey page loads.

## Implementation Summary
Normalized `ensureNestedStringArrayValue` now bails early when nested props already hold string arrays, preventing the builder's watchers from re-triggering recursively while still coercing legacy stored values.

## Documentation Overview
- Added guard logic so the helper only mutates nested props when they lack data or contain non-string entries, eliminating the watcher feedback loop.
- Legacy `:<key>` storage is still migrated the first time the helper runs, but subsequent renders leave reactive references untouched.
- No template changes were required; the fix strictly targets the data normalization path invoked by nested stringarray editors.

## Implementation Examples
- `layers/content/app/components/builder/NodeEditor.vue:2559` – helper now checks for existing string arrays before cloning and only deletes legacy storage keys when present.
- `layers/content/app/components/builder/NodeEditor.vue:2575` – when the nested prop is missing entirely, the helper initializes it once and reuses the same array on later renders.
