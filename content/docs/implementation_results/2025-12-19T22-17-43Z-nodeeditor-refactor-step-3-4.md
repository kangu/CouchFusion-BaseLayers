# Nodeeditor Refactor Step 3 4

## Initial Prompt
Implement the specs in `content/docs/2025-12-19T20-46-41Z-nodeeditor-refactor-plan.md`, proceed step by step, then proceed with step 3 and step 4.

## Implementation Summary
- Added `NodeField.vue` as a reusable wrapper for node editor fields (label, match outline, description, error).
- Extracted `NodePropsPanel.vue` to host top-level and extra props rendering, and wired it into `NodeEditor.vue`.
- Preserved custom UI `field-context` handling while routing prop updates through the new panel.
- Marked refactor plan steps 3-4 complete and verified `bunx vitest` passes from `layers`.

## Documentation Overview
- Centralized node editor field chrome in `NodeField.vue`, keeping match outlines and error messaging consistent.
- Moved the full top-level + extra props rendering into `NodePropsPanel.vue` to slim down `NodeEditor.vue`.
- Left nested array/object rendering inline within `NodePropsPanel.vue` to avoid behavioral changes ahead of later refactor steps.

## Implementation Examples
```vue
<NodePropsPanel
    :visible-props="visibleProps"
    :prop-draft="propDraft"
    :extra-props-draft="extraPropsDraft"
    :filtered-extra-prop-entries="filteredExtraPropEntries"
    :json-errors="jsonErrors"
    :object-field-errors="objectFieldErrors"
    :collapsed-arrays="collapsedArrays"
    :drag-over-array-item="dragOverArrayItem"
    :is-search-active="isSearchActive"
    :matches-search="matchesSearch"
    :filter-visible-fields="filterVisibleFields"
    :should-highlight-text="shouldHighlightText"
    :get-highlight-markup="getHighlightMarkup"
    :should-highlight-select="shouldHighlightSelect"
    :sync-highlight-scroll="syncHighlightScroll"
    :schedule-prop-update="schedulePropUpdate"
    :flush-prop-update="flushPropUpdate"
    :apply-prop="applyProp"
    :handle-custom-prop-update="handleCustomPropUpdate"
    :handle-object-field-change="handleObjectFieldChange"
    :handle-array-item-field-change="handleArrayItemFieldChange"
    :handle-custom-array-field-update="handleCustomArrayFieldUpdate"
    :handle-string-array-change="handleStringArrayChange"
    :handle-array-item-string-array-change="handleArrayItemStringArrayChange"
    :handle-array-item-object-field-change="handleArrayItemObjectFieldChange"
    :handle-array-item-object-json-change="handleArrayItemObjectJsonChange"
    :handle-nested-array-item-string-array-change="handleNestedArrayItemStringArrayChange"
    :handle-nested-array-item-object-field-change="handleNestedArrayItemObjectFieldChange"
    :handle-nested-array-item-object-json-change="handleNestedArrayItemObjectJsonChange"
    :get-filtered-json-array-items="getFilteredJsonArrayItems"
    :get-filtered-string-array-items="getFilteredStringArrayItems"
    :get-filtered-array-item-string-array-items="getFilteredArrayItemStringArrayItems"
    :get-array-item-string-array-items="getArrayItemStringArrayItems"
    :get-array-item-object-value="getArrayItemObjectValue"
    :get-nested-array-items="getNestedArrayItems"
    :get-nested-array-item-string-array-items="getNestedArrayItemStringArrayItems"
    :get-nested-array-item-object-value="getNestedArrayItemObjectValue"
    :add-array-item-string-array-item="addArrayItemStringArrayItem"
    :add-nested-array-item="addNestedArrayItem"
    :add-nested-array-item-string-array-item="addNestedArrayItemStringArrayItem"
    :remove-array-item="removeArrayItem"
    :remove-string-array-item="removeStringArrayItem"
    :remove-array-item-string-array-item="removeArrayItemStringArrayItem"
    :remove-nested-array-item="removeNestedArrayItem"
    :remove-nested-array-item-string-array-item="removeNestedArrayItemStringArrayItem"
    :open-insert-dialog="openInsertDialog"
    :toggle-array="toggleArray"
    :is-nested-array-collapsed="isNestedArrayCollapsed"
    :toggle-nested-array="toggleNestedArray"
    :open-top-level-array-reorder-dialog="openTopLevelArrayReorderDialog"
    :open-array-item-string-array-reorder-dialog="openArrayItemStringArrayReorderDialog"
    :open-nested-json-array-reorder-dialog="openNestedJsonArrayReorderDialog"
    :open-nested-string-array-reorder-dialog="openNestedStringArrayReorderDialog"
    :handle-array-item-drag-start="handleArrayItemDragStart"
    :handle-array-item-drag-enter="handleArrayItemDragEnter"
    :handle-array-item-drag-leave="handleArrayItemDragLeave"
    :handle-array-item-drop="handleArrayItemDrop"
    :handle-array-item-drag-end="handleArrayItemDragEnd"
    :update-nested-array-item-field="updateNestedArrayItemField"
    :update-custom-nested-array-item-field="updateCustomNestedArrayItemField"
    :format-json-value="formatJsonValue"
/>
```

```vue
<NodeField
    :label="prop.label"
    :description="prop.description"
    :error="jsonErrors[prop.key]"
>
    <NodeTextField
        v-model="propDraft[prop.key]"
        :show-highlight="shouldHighlightText(propDraft[prop.key], prop.type)"
        :highlight-markup="getHighlightMarkup(propDraft[prop.key])"
    />
</NodeField>
```
