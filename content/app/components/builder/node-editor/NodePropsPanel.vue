<template>
    <div v-if="visibleProps.length" class="node-panel__props">
        <NodeField
            v-for="prop in visibleProps"
            :key="prop.key"
            :tag="fieldWrapperTag(prop)"
            :role="fieldWrapperRole(prop)"
            :listeners="fieldWrapperListeners(prop)"
            :is-row="prop.type === 'boolean'"
            :is-match="shouldHighlightSelect(prop, propDraft[prop.key])"
            :is-localized="Boolean(prop.localized)"
            :label="prop.label"
            :description="prop.description"
            :error="jsonErrors[prop.key]"
        >
            <template v-if="prop.type === 'textarea'">
                <div class="node-panel__field-inline-control">
                    <NodeTextareaField
                        v-model="propDraft[prop.key]"
                        :placeholder="prop.placeholder"
                        :rows="3"
                        :show-highlight="
                            shouldHighlightText(propDraft[prop.key], prop.type)
                        "
                        :highlight-markup="getHighlightMarkup(propDraft[prop.key])"
                        @input="
                            () =>
                                schedulePropUpdate(
                                    prop.key,
                                    propDraft[prop.key],
                                    prop.type,
                                )
                        "
                        @blur="
                            () =>
                                flushPropUpdate(
                                    prop.key,
                                    propDraft[prop.key],
                                    prop.type,
                                )
                        "
                        @scroll="syncHighlightScroll"
                    />
                    <button
                        v-if="canTranslateField(prop)"
                        type="button"
                        class="node-panel__translate-inline"
                        @click="
                            () =>
                                requestTranslateField(
                                    [prop.key],
                                    prop.label,
                                )
                        "
                    >
                        Translate
                    </button>
                </div>
            </template>
            <template v-else-if="prop.type === 'boolean'">
                <span class="node-panel__checkbox">
                    <input
                        type="checkbox"
                        class="node-panel__checkbox-input"
                        :checked="Boolean(propDraft[prop.key])"
                        @change="
                            (event: Event) =>
                                applyProp(
                                    prop.key,
                                    (event.target as HTMLInputElement).checked,
                                    prop.type,
                                )
                        "
                    />
                    <span class="node-panel__checkbox-box" aria-hidden="true">
                        <svg
                            viewBox="0 0 20 20"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                d="M5 10.5L8.5 14L15 6"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            />
                        </svg>
                    </span>
                </span>
            </template>
            <template v-else-if="prop.type === 'select'">
                <NodeRemoteSelect
                    :schema="prop"
                    :model-value="propDraft[prop.key]"
                    @update:model-value="
                        (value) => {
                            propDraft[prop.key] = value;
                            applyProp(prop.key, value, prop.type);
                        }
                    "
                />
            </template>
            <template v-else-if="prop.type === 'json'">
                <div class="node-panel__input-wrap">
                    <div
                        v-if="shouldHighlightText(propDraft[prop.key], prop.type)"
                        class="node-panel__input-highlight node-panel__input-highlight--multiline font-mono"
                        v-html="getHighlightMarkup(propDraft[prop.key])"
                        aria-hidden="true"
                    />
                    <textarea
                        v-model="propDraft[prop.key]"
                        class="font-mono"
                        rows="6"
                        @change="
                            () =>
                                applyProp(
                                    prop.key,
                                    propDraft[prop.key],
                                    'json',
                                )
                        "
                        @blur="
                            () =>
                                applyProp(
                                    prop.key,
                                    propDraft[prop.key],
                                    'json',
                                )
                        "
                        @scroll="syncHighlightScroll"
                    />
                </div>
            </template>
            <template v-else-if="prop.type === 'jsonobject' && prop.ui?.component">
                <component
                    :is="prop.ui.component"
                    :model-value="propDraft[prop.key]"
                    :transform-value="
                        isImageFieldSchema(prop)
                            ? (propDraft[imageKitTransformPropKey(prop.key)] ??
                              '')
                            : undefined
                    "
                    :prop-definition="prop"
                    :field-context="{ propKey: prop.key, searchQuery }"
                    @update:modelValue="
                        (value: unknown) =>
                            handleCustomPropUpdate(prop, value, {
                                debounce: true,
                            })
                    "
                    @update:transformValue="
                        (value: unknown) => {
                            const normalized =
                                normalizeImageKitTransformValue(value);
                            const companionKey = imageKitTransformPropKey(
                                prop.key,
                            );
                            propDraft[companionKey] = normalized ?? '';
                            schedulePropUpdate(
                                companionKey,
                                normalized,
                                'text',
                            );
                        }
                    "
                />
            </template>
            <template v-else-if="prop.type === 'jsonobject'">
                <NodeObjectField
                    :schema="prop"
                    :value="propDraft[prop.key]"
                    :path-prefix="[prop.key]"
                    :field-errors="objectFieldErrors[prop.key]"
                    :field-key="(field) => `${prop.key}-${field.key}`"
                    :field-context="() => ({ propKey: prop.key, searchQuery })"
                    :filter-visible-fields="filterVisibleFields"
                    :should-highlight-text="shouldHighlightText"
                    :get-highlight-markup="getHighlightMarkup"
                    :should-highlight-select="shouldHighlightSelect"
                    :sync-highlight-scroll="syncHighlightScroll"
                    :search-query="searchQuery"
                    :on-field-change="(schema, field, value, options) =>
                        handleObjectFieldChange(prop.key, field, value, options)"
                    :on-json-input="(_, value) =>
                        (propDraft[prop.key] = value)"
                    :on-json-change="(_, value) =>
                        applyProp(prop.key, value, 'json')"
                    :json-value="formatJsonValue(propDraft[prop.key])"
                    :json-rows="6"
                    :json-highlight-type="prop.type"
                    :on-translate-field="onTranslateField"
                />
            </template>
            <template v-else-if="prop.type === 'jsonarray' || prop.type === 'stringarray'">
                <NodeArrayField
                    :prop="prop"
                    :path-prefix="[prop.key]"
                    :prop-draft="propDraft"
                    :collapsed-arrays="collapsedArrays"
                    :drag-over-array-item="dragOverArrayItem"
                    :is-search-active="isSearchActive"
                    :search-query="searchQuery"
                    :matches-search="matchesSearch"
                    :filter-visible-fields="filterVisibleFields"
                    :should-highlight-text="shouldHighlightText"
                    :get-highlight-markup="getHighlightMarkup"
                    :should-highlight-select="shouldHighlightSelect"
                    :sync-highlight-scroll="syncHighlightScroll"
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
                    :handle-array-item-field-change="handleArrayItemFieldChange"
                    :handle-custom-array-field-update="handleCustomArrayFieldUpdate"
                    :handle-string-array-change="handleStringArrayChange"
                    :handle-array-item-string-array-change="handleArrayItemStringArrayChange"
                    :handle-array-item-object-field-change="handleArrayItemObjectFieldChange"
                    :handle-array-item-object-json-change="handleArrayItemObjectJsonChange"
                    :handle-nested-array-item-string-array-change="handleNestedArrayItemStringArrayChange"
                    :handle-nested-array-item-object-field-change="handleNestedArrayItemObjectFieldChange"
                    :handle-nested-array-item-object-json-change="handleNestedArrayItemObjectJsonChange"
                    :update-nested-array-item-field="updateNestedArrayItemField"
                    :update-custom-nested-array-item-field="updateCustomNestedArrayItemField"
                    :format-json-value="formatJsonValue"
                    :on-translate-field="onTranslateField"
                />
            </template>
            <template v-else-if="prop.ui?.component">
                <div class="node-panel__field-inline-control">
                    <component
                        :is="prop.ui.component"
                        :model-value="propDraft[prop.key]"
                        :transform-value="
                            isImageFieldSchema(prop)
                                ? (propDraft[imageKitTransformPropKey(prop.key)] ??
                                  '')
                                : undefined
                        "
                        :prop-definition="prop"
                        :field-context="{ propKey: prop.key, searchQuery }"
                        @update:modelValue="
                            (value: unknown) =>
                                handleCustomPropUpdate(prop, value, {
                                    debounce: true,
                                })
                        "
                        @update:transformValue="
                            (value: unknown) => {
                                const normalized =
                                    normalizeImageKitTransformValue(value);
                                const companionKey = imageKitTransformPropKey(
                                    prop.key,
                                );
                                propDraft[companionKey] = normalized ?? '';
                                schedulePropUpdate(
                                    companionKey,
                                    normalized,
                                    'text',
                                );
                            }
                        "
                    />
                    <button
                        v-if="canTranslateField(prop)"
                        type="button"
                        class="node-panel__translate-inline"
                        @click="
                            () =>
                                requestTranslateField(
                                    [prop.key],
                                    prop.label,
                                )
                        "
                    >
                        Translate
                    </button>
                </div>
            </template>
            <template v-else>
                <div class="node-panel__field-inline-control">
                    <NodeTextField
                        v-model="propDraft[prop.key]"
                        :placeholder="prop.placeholder"
                        :input-type="prop.type === 'number' ? 'number' : 'text'"
                        :show-highlight="
                            shouldHighlightText(propDraft[prop.key], prop.type)
                        "
                        :highlight-markup="getHighlightMarkup(propDraft[prop.key])"
                        @input="
                            () =>
                                schedulePropUpdate(
                                    prop.key,
                                    propDraft[prop.key],
                                    prop.type,
                                )
                        "
                        @blur="
                            () =>
                                flushPropUpdate(
                                    prop.key,
                                    propDraft[prop.key],
                                    prop.type,
                                )
                        "
                    />
                    <button
                        v-if="canTranslateField(prop)"
                        type="button"
                        class="node-panel__translate-inline"
                        @click="
                            () =>
                                requestTranslateField(
                                    [prop.key],
                                    prop.label,
                                )
                        "
                    >
                        Translate
                    </button>
                </div>
            </template>
        </NodeField>
    </div>

    <div v-if="filteredExtraPropEntries.length" class="node-panel__props">
        <NodeField
            v-for="entry in filteredExtraPropEntries"
            :key="entry.key"
            :label="entry.key"
        >
            <NodeTextField
                v-model="extraPropsDraft[entry.key]"
                :show-highlight="
                    shouldHighlightText(extraPropsDraft[entry.key], 'text')
                "
                :highlight-markup="
                    getHighlightMarkup(extraPropsDraft[entry.key])
                "
                @input="
                    () =>
                        schedulePropUpdate(
                            entry.key,
                            extraPropsDraft[entry.key],
                            'text',
                        )
                "
                @blur="
                    () =>
                        flushPropUpdate(
                            entry.key,
                            extraPropsDraft[entry.key],
                            'text',
                        )
                "
            />
        </NodeField>
    </div>
</template>

<script setup lang="ts">
import type { ComponentArrayItemField, ComponentPropSchema } from "~/types/builder";
import NodeArrayField from "./NodeArrayField.vue";
import NodeField from "./NodeField.vue";
import NodeObjectField from "./NodeObjectField.vue";
import NodeRemoteSelect from "./NodeRemoteSelect.vue";
import NodeTextField from "./NodeTextField.vue";
import NodeTextareaField from "./NodeTextareaField.vue";

type AnyHandler = (...args: any[]) => void;
type DragOverArrayItem = { propKey: string; index: number } | null;

const props = defineProps<{
    searchQuery?: string;
    visibleProps: ComponentPropSchema[];
    propDraft: Record<string, any>;
    extraPropsDraft: Record<string, string>;
    filteredExtraPropEntries: Array<{ key: string; value: unknown }>;
    jsonErrors: Record<string, string | null>;
    objectFieldErrors: Record<string, Record<string, string | null>>;
    collapsedArrays: Record<string, boolean>;
    dragOverArrayItem: DragOverArrayItem;
    isSearchActive: boolean;
    matchesSearch: (value: unknown) => boolean;
    filterVisibleFields: <
        T extends { key: string; visibleWhen?: unknown },
    >(
        fields: T[] | undefined,
        context: Record<string, any> | undefined,
    ) => T[];
    shouldHighlightText: (value: unknown, type?: string) => boolean;
    getHighlightMarkup: (value: unknown) => string;
    shouldHighlightSelect: (
        schema: ComponentPropSchema | ComponentArrayItemField,
        value: unknown,
    ) => boolean;
    syncHighlightScroll: (event: Event) => void;
    schedulePropUpdate: AnyHandler;
    flushPropUpdate: AnyHandler;
    applyProp: AnyHandler;
    handleCustomPropUpdate: AnyHandler;
    handleObjectFieldChange: AnyHandler;
    handleArrayItemFieldChange: AnyHandler;
    handleCustomArrayFieldUpdate: AnyHandler;
    handleStringArrayChange: AnyHandler;
    handleArrayItemStringArrayChange: AnyHandler;
    handleArrayItemObjectFieldChange: AnyHandler;
    handleArrayItemObjectJsonChange: AnyHandler;
    handleNestedArrayItemStringArrayChange: AnyHandler;
    handleNestedArrayItemObjectFieldChange: AnyHandler;
    handleNestedArrayItemObjectJsonChange: AnyHandler;
    getFilteredJsonArrayItems: (
        propKey: string,
    ) => Array<{ value: any; index: number }>;
    getFilteredStringArrayItems: (
        propKey: string,
    ) => Array<{ value: any; index: number }>;
    getFilteredArrayItemStringArrayItems: (
        propKey: string,
        parentIndex: number,
        field: ComponentArrayItemField,
    ) => Array<{ value: any; index: number }>;
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
    updateNestedArrayItemField: AnyHandler;
    updateCustomNestedArrayItemField: AnyHandler;
    formatJsonValue: (value: unknown) => string;
    onTranslateField?: (payload: {
        propPath: Array<string | number>;
        label?: string;
    }) => void;
}>();

const fieldWrapperTag = (schema: ComponentPropSchema) =>
    schema.ui?.component ? "div" : "label";

const fieldWrapperRole = (schema: ComponentPropSchema) =>
    schema.ui?.component ? "group" : undefined;

const preventFieldWrapperActivation = (event: Event) => {
    event.stopPropagation();
    event.preventDefault();
};

const fieldWrapperListeners = (schema: ComponentPropSchema) => {
    if (schema.ui?.component) {
        return {
            onMousedown: preventFieldWrapperActivation,
            onClick: preventFieldWrapperActivation,
        };
    }
    return {};
};

const imageKitTransformPropKey = (key: string) => `${key}ImagekitTransforms`;

const isImageFieldSchema = (schema: ComponentPropSchema) =>
    schema.ui?.component === "ContentImageField";

const normalizeImageKitTransformValue = (value: unknown) => {
    if (typeof value !== "string") {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
};

const canTranslateField = (schema: ComponentPropSchema): boolean => {
    if (!schema.localized || !schema.key) {
        return false;
    }

    if (
        schema.type === "text" ||
        schema.type === "textarea" ||
        schema.type === "stringarray"
    ) {
        return true;
    }

    return schema.ui?.component === "ContentRichTextField";
};

const requestTranslateField = (
    propPath: Array<string | number>,
    label?: string,
) => {
    if (!propPath.length) {
        return;
    }

    props.onTranslateField?.({
        propPath,
        label,
    });
};
</script>
