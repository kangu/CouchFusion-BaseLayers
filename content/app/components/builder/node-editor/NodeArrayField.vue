<template>
    <div class="node-panel__array" :data-collapsed="collapsedArrays[prop.key]">
        <div class="node-panel__array-header">
            <button
                type="button"
                class="node-panel__array-toggle"
                :data-state="
                    collapsedArrays[prop.key] ? 'collapsed' : 'expanded'
                "
                @click="toggleArray(prop.key)"
            >
                {{ collapsedArrays[prop.key] ? "Expand" : "Collapse" }}
                ({{ propDraft[prop.key]?.length || 0 }})
            </button>
            <button
                type="button"
                class="node-panel__array-add"
                @click="openInsertDialog(prop)"
            >
                <span class="node-panel__array-add-icon" aria-hidden="true"
                    >+</span
                >
            </button>
        </div>
        <NodeArrayItem
            v-for="entry in itemEntries"
            :key="`${prop.key}-${entry.index}`"
            :prop="prop"
            :entry="entry"
            :prop-draft="propDraft"
            :collapsed-arrays="collapsedArrays"
            :drag-over-array-item="dragOverArrayItem"
            :is-search-active="isSearchActive"
            :matches-search="matchesSearch"
            :filter-visible-fields="filterVisibleFields"
            :should-highlight-text="shouldHighlightText"
            :get-highlight-markup="getHighlightMarkup"
            :should-highlight-select="shouldHighlightSelect"
            :sync-highlight-scroll="syncHighlightScroll"
            :handle-array-item-drag-start="handleArrayItemDragStart"
            :handle-array-item-drag-enter="handleArrayItemDragEnter"
            :handle-array-item-drag-leave="handleArrayItemDragLeave"
            :handle-array-item-drop="handleArrayItemDrop"
            :handle-array-item-drag-end="handleArrayItemDragEnd"
            :handle-array-item-field-change="handleArrayItemFieldChange"
            :handle-custom-array-field-update="handleCustomArrayFieldUpdate"
            :handle-string-array-change="handleStringArrayChange"
            :handle-array-item-string-array-change="handleArrayItemStringArrayChange"
            :handle-array-item-object-field-change="handleArrayItemObjectFieldChange"
            :handle-array-item-object-json-change="handleArrayItemObjectJsonChange"
            :handle-nested-array-item-string-array-change="handleNestedArrayItemStringArrayChange"
            :handle-nested-array-item-object-field-change="handleNestedArrayItemObjectFieldChange"
            :handle-nested-array-item-object-json-change="handleNestedArrayItemObjectJsonChange"
            :get-array-item-string-array-items="getArrayItemStringArrayItems"
            :get-filtered-array-item-string-array-items="getFilteredArrayItemStringArrayItems"
            :get-nested-array-items="getNestedArrayItems"
            :get-nested-array-item-string-array-items="getNestedArrayItemStringArrayItems"
            :get-array-item-object-value="getArrayItemObjectValue"
            :get-nested-array-item-object-value="getNestedArrayItemObjectValue"
            :add-array-item-string-array-item="addArrayItemStringArrayItem"
            :add-nested-array-item="addNestedArrayItem"
            :add-nested-array-item-string-array-item="addNestedArrayItemStringArrayItem"
            :remove-array-item="removeArrayItem"
            :remove-string-array-item="removeStringArrayItem"
            :remove-array-item-string-array-item="removeArrayItemStringArrayItem"
            :remove-nested-array-item="removeNestedArrayItem"
            :remove-nested-array-item-string-array-item="removeNestedArrayItemStringArrayItem"
            :is-nested-array-collapsed="isNestedArrayCollapsed"
            :toggle-nested-array="toggleNestedArray"
            :open-top-level-array-reorder-dialog="openTopLevelArrayReorderDialog"
            :open-array-item-string-array-reorder-dialog="openArrayItemStringArrayReorderDialog"
            :open-nested-json-array-reorder-dialog="openNestedJsonArrayReorderDialog"
            :open-nested-string-array-reorder-dialog="openNestedStringArrayReorderDialog"
            :update-nested-array-item-field="updateNestedArrayItemField"
            :update-custom-nested-array-item-field="updateCustomNestedArrayItemField"
            :format-json-value="formatJsonValue"
        />
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ComponentArrayItemField, ComponentPropSchema } from "~/types/builder";
import NodeArrayItem from "./NodeArrayItem.vue";

type AnyHandler = (...args: any[]) => void;
type DragOverArrayItem = { propKey: string; index: number } | null;

type FilterEntry = { value: any; index: number };

type FilterVisibleFields = <
    T extends { key: string; visibleWhen?: unknown },
>(
    fields: T[] | undefined,
    context: Record<string, any> | undefined,
) => T[];

const props = defineProps<{
    prop: ComponentPropSchema;
    propDraft: Record<string, any>;
    collapsedArrays: Record<string, boolean>;
    dragOverArrayItem: DragOverArrayItem;
    isSearchActive: boolean;
    matchesSearch: (value: unknown) => boolean;
    filterVisibleFields: FilterVisibleFields;
    shouldHighlightText: (value: unknown, type?: string) => boolean;
    getHighlightMarkup: (value: unknown) => string;
    shouldHighlightSelect: (
        schema: ComponentPropSchema | ComponentArrayItemField,
        value: unknown,
    ) => boolean;
    syncHighlightScroll: (event: Event) => void;
    getFilteredJsonArrayItems: (propKey: string) => FilterEntry[];
    getFilteredStringArrayItems: (propKey: string) => FilterEntry[];
    getFilteredArrayItemStringArrayItems: (
        propKey: string,
        parentIndex: number,
        field: ComponentArrayItemField,
    ) => FilterEntry[];
    getArrayItemStringArrayItems: AnyHandler;
    getArrayItemObjectValue: AnyHandler;
    getNestedArrayItems: AnyHandler;
    getNestedArrayItemStringArrayItems: AnyHandler;
    getNestedArrayItemObjectValue: AnyHandler;
    addArrayItemStringArrayItem: AnyHandler;
    addNestedArrayItem: AnyHandler;
    addNestedArrayItemStringArrayItem: AnyHandler;
    removeArrayItem: AnyHandler;
    removeStringArrayItem: AnyHandler;
    removeArrayItemStringArrayItem: AnyHandler;
    removeNestedArrayItem: AnyHandler;
    removeNestedArrayItemStringArrayItem: AnyHandler;
    openInsertDialog: AnyHandler;
    toggleArray: AnyHandler;
    isNestedArrayCollapsed: AnyHandler;
    toggleNestedArray: AnyHandler;
    openTopLevelArrayReorderDialog: AnyHandler;
    openArrayItemStringArrayReorderDialog: AnyHandler;
    openNestedJsonArrayReorderDialog: AnyHandler;
    openNestedStringArrayReorderDialog: AnyHandler;
    handleArrayItemDragStart: AnyHandler;
    handleArrayItemDragEnter: AnyHandler;
    handleArrayItemDragLeave: AnyHandler;
    handleArrayItemDrop: AnyHandler;
    handleArrayItemDragEnd: AnyHandler;
    handleArrayItemFieldChange: AnyHandler;
    handleCustomArrayFieldUpdate: AnyHandler;
    handleStringArrayChange: AnyHandler;
    handleArrayItemStringArrayChange: AnyHandler;
    handleArrayItemObjectFieldChange: AnyHandler;
    handleArrayItemObjectJsonChange: AnyHandler;
    handleNestedArrayItemStringArrayChange: AnyHandler;
    handleNestedArrayItemObjectFieldChange: AnyHandler;
    handleNestedArrayItemObjectJsonChange: AnyHandler;
    updateNestedArrayItemField: AnyHandler;
    updateCustomNestedArrayItemField: AnyHandler;
    formatJsonValue: (value: unknown) => string;
}>();

const itemEntries = computed(() => {
    if (props.prop.type === "jsonarray") {
        return props.getFilteredJsonArrayItems(props.prop.key);
    }
    if (props.prop.type === "stringarray") {
        return props.getFilteredStringArrayItems(props.prop.key);
    }
    return [] as FilterEntry[];
});
</script>
