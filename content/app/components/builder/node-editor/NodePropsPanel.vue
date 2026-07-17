<template>
    <div v-if="visibleProps.length" class="node-panel__props">
        <NodeField
            v-for="prop in visibleProps"
            :key="prop.key"
            :data-content-prop-path="prop.key"
            :tag="fieldWrapperTag(prop)"
            :role="fieldWrapperRole(prop)"
            :listeners="fieldWrapperListeners(prop)"
            :is-row="prop.type === 'boolean'"
            :is-match="shouldHighlightSelect(prop, propDraft[prop.key])"
            :is-localized="canTranslateField(prop)"
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
                    <NodeTranslateInline
                        v-if="canTranslateField(prop)"
                        :selected="isTranslationSelected([prop.key])"
                        @toggle="
                            (selected) =>
                                toggleTranslationSelection(
                                    [prop.key],
                                    prop.label,
                                    selected,
                                )
                        "
                        @translate="
                            () =>
                                requestTranslateField(
                                    [prop.key],
                                    prop.label,
                                )
                        "
                    />
                </div>
            </template>
            <template v-else-if="prop.type === 'boolean'">
                <NodeBooleanToggle
                    :model-value="Boolean(propDraft[prop.key])"
                    :label="prop.label"
                    @update:model-value="
                        (value) => applyProp(prop.key, value, prop.type)
                    "
                />
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
                    :on-toggle-translate-selection="onToggleTranslateSelection"
                    :is-translate-selected="isTranslateSelected"
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
                    :open-array-item-string-array-insert-dialog="openArrayItemStringArrayInsertDialog"
                    :open-nested-json-array-insert-dialog="openNestedJsonArrayInsertDialog"
                    :open-nested-string-array-insert-dialog="openNestedStringArrayInsertDialog"
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
                    :on-toggle-translate-selection="onToggleTranslateSelection"
                    :is-translate-selected="isTranslateSelected"
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
                    <NodeTranslateInline
                        v-if="canTranslateField(prop)"
                        :selected="isTranslationSelected([prop.key])"
                        @toggle="
                            (selected) =>
                                toggleTranslationSelection(
                                    [prop.key],
                                    prop.label,
                                    selected,
                                )
                        "
                        @translate="
                            () =>
                                requestTranslateField(
                                    [prop.key],
                                    prop.label,
                                )
                        "
                    />
                </div>
            </template>
            <template v-else>
                <div class="node-panel__field-inline-control">
                    <div v-if="isRangeWidget(prop)" class="flex items-center gap-2">
                        <NodeTextField
                            v-model="propDraft[prop.key]"
                            class="flex-1"
                            :placeholder="prop.placeholder"
                            :input-type="resolvePrimitiveInputType(prop)"
                            :min="resolveNumericUiBound(prop, 'min')"
                            :max="resolveNumericUiBound(prop, 'max')"
                            :step="resolveNumericUiBound(prop, 'step')"
                            :show-highlight="
                                shouldHighlightText(propDraft[prop.key], prop.type)
                            "
                            :highlight-markup="
                                getHighlightMarkup(propDraft[prop.key])
                            "
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
                        <output
                            class="min-w-16 rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-right text-xs font-semibold tabular-nums text-slate-700"
                        >
                            {{ formatRangeDisplayValue(propDraft[prop.key]) }}
                        </output>
                    </div>
                    <NodeTextField
                        v-else
                        v-model="propDraft[prop.key]"
                        :placeholder="prop.placeholder"
                        :input-type="resolvePrimitiveInputType(prop)"
                        :min="resolveNumericUiBound(prop, 'min')"
                        :max="resolveNumericUiBound(prop, 'max')"
                        :step="resolveNumericUiBound(prop, 'step')"
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
                    <NodeTranslateInline
                        v-if="canTranslateField(prop)"
                        :selected="isTranslationSelected([prop.key])"
                        @toggle="
                            (selected) =>
                                toggleTranslationSelection(
                                    [prop.key],
                                    prop.label,
                                    selected,
                                )
                        "
                        @translate="
                            () =>
                                requestTranslateField(
                                    [prop.key],
                                    prop.label,
                                )
                        "
                    />
                </div>
            </template>
        </NodeField>
    </div>

    <div v-if="filteredExtraPropEntries.length" class="node-panel__props">
        <NodeField
            v-for="entry in filteredExtraPropEntries"
            :key="entry.key"
            :label="entry.key"
            :data-content-prop-path="entry.key"
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
import NodeBooleanToggle from "./NodeBooleanToggle.vue";
import NodeField from "./NodeField.vue";
import NodeObjectField from "./NodeObjectField.vue";
import NodeRemoteSelect from "./NodeRemoteSelect.vue";
import NodeTextField from "./NodeTextField.vue";
import NodeTextareaField from "./NodeTextareaField.vue";
import NodeTranslateInline from "./NodeTranslateInline.vue";

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
    openArrayItemStringArrayInsertDialog: AnyHandler;
    openNestedJsonArrayInsertDialog: AnyHandler;
    openNestedStringArrayInsertDialog: AnyHandler;
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
    onToggleTranslateSelection?: (payload: {
        propPath: Array<string | number>;
        label?: string;
        selected: boolean;
    }) => void;
    isTranslateSelected?: (propPath: Array<string | number>) => boolean;
}>();

const fieldWrapperTag = (schema: ComponentPropSchema) =>
    schema.type === "boolean" ? "label" : "div";

const resolvePrimitiveInputType = (schema: ComponentPropSchema) => {
    if (schema.type !== "number") {
        return "text";
    }
    return schema.ui?.widget === "range" ? "range" : "number";
};

const isRangeWidget = (schema: ComponentPropSchema) =>
    resolvePrimitiveInputType(schema) === "range";

const resolveNumericUiBound = (
    schema: ComponentPropSchema,
    key: "min" | "max" | "step",
) => {
    if (schema.type !== "number") {
        return undefined;
    }
    const value = schema.ui?.[key];
    if (typeof value === "number" || typeof value === "string") {
        return value;
    }
    return undefined;
};

const formatRangeDisplayValue = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) {
        return String(value);
    }
    if (typeof value === "string") {
        const numeric = Number(value);
        if (Number.isFinite(numeric)) {
            return String(numeric);
        }
        return value.trim().length > 0 ? value : "0";
    }
    return "0";
};

const fieldWrapperRole = (schema: ComponentPropSchema) =>
    schema.type === "boolean" ? undefined : "group";

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
    if (!props.onTranslateField || !props.onToggleTranslateSelection) {
        return false;
    }

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

const isTranslationSelected = (propPath: Array<string | number>): boolean =>
    props.isTranslateSelected?.(propPath) ?? false;

const toggleTranslationSelection = (
    propPath: Array<string | number>,
    label: string | undefined,
    selected: boolean,
) => {
    if (!propPath.length) {
        return;
    }

    props.onToggleTranslateSelection?.({
        propPath,
        label,
        selected,
    });
};
</script>
