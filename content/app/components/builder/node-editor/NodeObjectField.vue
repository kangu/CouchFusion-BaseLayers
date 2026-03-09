<template>
    <template v-if="schema.fields?.length">
        <div
            class="node-panel__object"
            :class="{ 'node-panel__object--nested': isNested }"
        >
            <label
                v-for="field in visibleFields"
                :key="fieldKey(field)"
                :class="[
                    'node-panel__field',
                    'node-panel__field--nested',
                    {
                        'node-panel__field--match': shouldHighlightSelect(
                            field,
                            objectValue?.[field.key],
                        ),
                        'node-panel__field--localized': Boolean(
                            field.localized,
                        ),
                    },
                ]"
            >
                <span>{{ field.label }}</span>
                <template v-if="field.type === 'textarea'">
                    <div class="node-panel__field-inline-control">
                        <div class="node-panel__input-wrap">
                            <div
                                v-if="
                                    shouldHighlightText(
                                        objectValue?.[field.key],
                                        field.type,
                                    )
                                "
                                class="node-panel__input-highlight node-panel__input-highlight--multiline"
                                v-html="getHighlightMarkup(objectValue?.[field.key])"
                                aria-hidden="true"
                            />
                            <textarea
                                v-model="objectValue[field.key]"
                                rows="3"
                                @input="
                                    () =>
                                        applyFieldChange(
                                            field,
                                            objectValue[field.key],
                                            { debounce: true },
                                        )
                                "
                                @change="
                                    () =>
                                        applyFieldChange(
                                            field,
                                            objectValue[field.key],
                                        )
                                "
                                @blur="
                                    () =>
                                        applyFieldChange(
                                            field,
                                            objectValue[field.key],
                                        )
                                "
                                @scroll="syncHighlightScroll"
                            />
                        </div>
                        <NodeTranslateInline
                            v-if="canTranslateField(field)"
                            :selected="isTranslationSelected([...pathPrefix, field.key])"
                            @toggle="
                                (selected) =>
                                    toggleTranslationSelection(
                                        [...pathPrefix, field.key],
                                        field.label,
                                        selected,
                                    )
                            "
                            @translate="
                                () =>
                                    requestTranslateField(
                                        [...pathPrefix, field.key],
                                        field.label,
                                    )
                            "
                        />
                    </div>
                </template>
                <template v-else-if="field.type === 'boolean'">
                    <span class="node-panel__checkbox">
                        <input
                            type="checkbox"
                            class="node-panel__checkbox-input"
                            :checked="Boolean(objectValue?.[field.key])"
                            @change="
                                (event: Event) =>
                                    applyFieldChange(
                                        field,
                                        (event.target as HTMLInputElement).checked,
                                    )
                            "
                        />
                        <span
                            class="node-panel__checkbox-box"
                            aria-hidden="true"
                        >
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
                <template v-else-if="field.type === 'number'">
                    <input
                        v-model.number="objectValue[field.key]"
                        type="number"
                        @input="
                            () =>
                                applyFieldChange(
                                    field,
                                    objectValue[field.key],
                                    { debounce: true },
                                )
                        "
                        @change="
                            () =>
                                applyFieldChange(
                                    field,
                                    objectValue[field.key],
                                )
                        "
                        @blur="
                            () =>
                                applyFieldChange(
                                    field,
                                    objectValue[field.key],
                                )
                        "
                    />
                </template>
                <template v-else-if="field.type === 'select'">
                    <NodeRemoteSelect
                        :schema="field"
                        :model-value="objectValue[field.key]"
                        @update:model-value="
                            (value) => {
                                objectValue[field.key] = value;
                                applyFieldChange(field, value);
                            }
                        "
                    />
                </template>
                <template v-else-if="field.ui?.component">
                    <div class="node-panel__field-inline-control">
                        <component
                            :is="field.ui.component"
                            :model-value="objectValue[field.key]"
                            :transform-value="
                                isImageFieldSchema(field)
                                    ? getImageKitTransformValue(
                                          objectValue,
                                          field.key,
                                      )
                                    : undefined
                            "
                            :prop-definition="field"
                            :field-context="withSearchContext(fieldContext(field))"
                            @update:modelValue="
                                (value: unknown) =>
                                    applyFieldChange(field, value, {
                                        debounce: true,
                                    })
                            "
                            @update:transformValue="
                                (value: unknown) =>
                                    applyFieldChange(
                                        imageKitTextCompanionField(field),
                                        normalizeImageKitTransformValue(value),
                                        { debounce: true },
                                    )
                            "
                        />
                        <NodeTranslateInline
                            v-if="canTranslateField(field)"
                            :selected="isTranslationSelected([...pathPrefix, field.key])"
                            @toggle="
                                (selected) =>
                                    toggleTranslationSelection(
                                        [...pathPrefix, field.key],
                                        field.label,
                                        selected,
                                    )
                            "
                            @translate="
                                () =>
                                    requestTranslateField(
                                        [...pathPrefix, field.key],
                                        field.label,
                                    )
                            "
                        />
                    </div>
                </template>
                <template v-else-if="field.type === 'jsonarray'">
                    <div
                        class="node-panel__array node-panel__array--nested"
                        :data-collapsed="collapsedArrays[field.key]"
                    >
                        <div
                            class="node-panel__array-header node-panel__array-header--nested"
                        >
                            <button
                                type="button"
                                class="node-panel__array-toggle"
                                :data-state="
                                    collapsedArrays[field.key]
                                        ? 'collapsed'
                                        : 'expanded'
                                "
                                @click="toggleArray(field.key)"
                            >
                                {{
                                    collapsedArrays[field.key]
                                        ? 'Expand'
                                        : 'Collapse'
                                }}
                                ({{ getArrayItems(field).length }})
                            </button>
                            <button
                                type="button"
                                class="node-panel__array-add"
                                @click="addArrayItem(field)"
                            >
                                <span
                                    class="node-panel__array-add-icon"
                                    aria-hidden="true"
                                    >+</span
                                >
                            </button>
                        </div>
                        <div
                            v-for="(arrayItem, index) in getArrayItems(field)"
                            :key="`${field.key}-${index}`"
                            class="node-panel__array-item node-panel__array-item--nested"
                            v-show="!collapsedArrays[field.key]"
                        >
                            <div
                                class="node-panel__array-fields node-panel__array-fields--nested"
                            >
                                <label
                                    v-for="arrayField in filterVisibleFields(
                                        field.items,
                                        arrayItem,
                                    )"
                                    :key="`${field.key}-${arrayField.key}-${index}`"
                                    :class="[
                                        'node-panel__field',
                                        'node-panel__field--nested',
                                        {
                                            'node-panel__field--match':
                                                shouldHighlightSelect(
                                                    arrayField,
                                                    arrayItem?.[
                                                        arrayField.key
                                                    ],
                                                ),
                                            'node-panel__field--localized':
                                                Boolean(
                                                    arrayField.localized,
                                                ),
                                        },
                                    ]"
                                >
                                    <span>{{ arrayField.label }}</span>
                                    <template
                                        v-if="
                                            arrayField.type === 'textarea'
                                        "
                                    >
                                        <div class="node-panel__field-inline-control">
                                            <div
                                                class="node-panel__input-wrap"
                                            >
                                                <div
                                                    v-if="
                                                        shouldHighlightText(
                                                            arrayItem?.[
                                                                arrayField.key
                                                            ],
                                                            arrayField.type,
                                                        )
                                                    "
                                                    class="node-panel__input-highlight node-panel__input-highlight--multiline"
                                                    v-html="
                                                        getHighlightMarkup(
                                                            arrayItem?.[
                                                                arrayField.key
                                                            ],
                                                        )
                                                    "
                                                    aria-hidden="true"
                                                />
                                                <textarea
                                                    v-model="
                                                        arrayItem[
                                                            arrayField.key
                                                        ]
                                                    "
                                                    rows="3"
                                                    @input="
                                                        () =>
                                                            updateArrayField(
                                                                field,
                                                                index,
                                                                arrayField,
                                                                arrayItem[
                                                                    arrayField.key
                                                                ],
                                                                {
                                                                    debounce: true,
                                                                },
                                                            )
                                                    "
                                                    @change="
                                                        () =>
                                                            updateArrayField(
                                                                field,
                                                                index,
                                                                arrayField,
                                                                arrayItem[
                                                                    arrayField.key
                                                                ],
                                                            )
                                                    "
                                                    @blur="
                                                        () =>
                                                            updateArrayField(
                                                                field,
                                                                index,
                                                                arrayField,
                                                                arrayItem[
                                                                    arrayField.key
                                                                ],
                                                            )
                                                    "
                                                    @scroll="syncHighlightScroll"
                                                />
                                            </div>
                                            <NodeTranslateInline
                                                v-if="canTranslateField(arrayField)"
                                                :selected="isTranslationSelected([
                                                    ...pathPrefix,
                                                    field.key,
                                                    index,
                                                    arrayField.key,
                                                ])"
                                                @toggle="
                                                    (selected) =>
                                                        toggleTranslationSelection(
                                                            [
                                                                ...pathPrefix,
                                                                field.key,
                                                                index,
                                                                arrayField.key,
                                                            ],
                                                            arrayField.label,
                                                            selected,
                                                        )
                                                "
                                                @translate="
                                                    () =>
                                                        requestTranslateField(
                                                            [
                                                                ...pathPrefix,
                                                                field.key,
                                                                index,
                                                                arrayField.key,
                                                            ],
                                                            arrayField.label,
                                                        )
                                                "
                                            />
                                        </div>
                                    </template>
                                    <template
                                        v-else-if="
                                            arrayField.type === 'boolean'
                                        "
                                    >
                                        <span class="node-panel__checkbox">
                                            <input
                                                type="checkbox"
                                                class="node-panel__checkbox-input"
                                                :checked="
                                                    Boolean(
                                                        arrayItem?.[
                                                            arrayField.key
                                                        ],
                                                    )
                                                "
                                                @change="
                                                    (event: Event) =>
                                                        updateArrayField(
                                                            field,
                                                            index,
                                                            arrayField,
                                                            (
                                                                event.target as HTMLInputElement
                                                            ).checked,
                                                        )
                                                "
                                            />
                                            <span
                                                class="node-panel__checkbox-box"
                                                aria-hidden="true"
                                            >
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
                                    <template
                                        v-else-if="
                                            arrayField.type === 'number'
                                        "
                                    >
                                        <input
                                            v-model.number="
                                                arrayItem[arrayField.key]
                                            "
                                            type="number"
                                            @input="
                                                () =>
                                                    updateArrayField(
                                                        field,
                                                        index,
                                                        arrayField,
                                                        arrayItem[
                                                            arrayField.key
                                                        ],
                                                        {
                                                            debounce: true,
                                                        },
                                                    )
                                            "
                                            @change="
                                                () =>
                                                    updateArrayField(
                                                        field,
                                                        index,
                                                        arrayField,
                                                        arrayItem[
                                                            arrayField.key
                                                        ],
                                                    )
                                            "
                                            @blur="
                                                () =>
                                                    updateArrayField(
                                                        field,
                                                        index,
                                                        arrayField,
                                                        arrayItem[
                                                            arrayField.key
                                                        ],
                                                    )
                                            "
                                        />
                                    </template>
                                    <template
                                        v-else-if="
                                            arrayField.type === 'select'
                                        "
                                    >
                                        <NodeRemoteSelect
                                            :schema="arrayField"
                                            :model-value="
                                                arrayItem[arrayField.key]
                                            "
                                            @update:model-value="
                                                (value) => {
                                                    arrayItem[arrayField.key] =
                                                        value;
                                                    updateArrayField(
                                                        field,
                                                        index,
                                                        arrayField,
                                                        value,
                                                    );
                                                }
                                            "
                                        />
                                    </template>
                                    <template
                                        v-else-if="arrayField.ui?.component"
                                    >
                                        <div class="node-panel__field-inline-control">
                                            <component
                                                :is="arrayField.ui.component"
                                                :model-value="
                                                    arrayItem[arrayField.key]
                                                "
                                                :transform-value="
                                                    isImageFieldSchema(arrayField)
                                                        ? getImageKitTransformValue(
                                                              arrayItem,
                                                              arrayField.key,
                                                          )
                                                        : undefined
                                                "
                                                :prop-definition="arrayField"
                                                :field-context="
                                                    withSearchContext(
                                                        fieldContext(arrayField),
                                                    )
                                                "
                                                @update:modelValue="
                                                    (value: unknown) =>
                                                        updateArrayField(
                                                            field,
                                                            index,
                                                            arrayField,
                                                            value,
                                                            { debounce: true },
                                                        )
                                                "
                                                @update:transformValue="
                                                    (value: unknown) =>
                                                        updateArrayField(
                                                            field,
                                                            index,
                                                            imageKitTextCompanionField(
                                                                arrayField,
                                                            ),
                                                            normalizeImageKitTransformValue(
                                                                value,
                                                            ),
                                                            { debounce: true },
                                                        )
                                                "
                                            />
                                            <NodeTranslateInline
                                                v-if="canTranslateField(arrayField)"
                                                :selected="isTranslationSelected([
                                                    ...pathPrefix,
                                                    field.key,
                                                    index,
                                                    arrayField.key,
                                                ])"
                                                @toggle="
                                                    (selected) =>
                                                        toggleTranslationSelection(
                                                            [
                                                                ...pathPrefix,
                                                                field.key,
                                                                index,
                                                                arrayField.key,
                                                            ],
                                                            arrayField.label,
                                                            selected,
                                                        )
                                                "
                                                @translate="
                                                    () =>
                                                        requestTranslateField(
                                                            [
                                                                ...pathPrefix,
                                                                field.key,
                                                                index,
                                                                arrayField.key,
                                                            ],
                                                            arrayField.label,
                                                        )
                                                "
                                            />
                                        </div>
                                    </template>
                                    <template v-else>
                                        <div class="node-panel__field-inline-control">
                                            <div
                                                class="node-panel__input-wrap"
                                            >
                                                <div
                                                    v-if="
                                                        shouldHighlightText(
                                                            arrayItem?.[
                                                                arrayField.key
                                                            ],
                                                            arrayField.type,
                                                        )
                                                    "
                                                    class="node-panel__input-highlight node-panel__input-highlight--single"
                                                    v-html="
                                                        getHighlightMarkup(
                                                            arrayItem?.[
                                                                arrayField.key
                                                            ],
                                                        )
                                                    "
                                                    aria-hidden="true"
                                                />
                                                <input
                                                    v-model="
                                                        arrayItem[arrayField.key]
                                                    "
                                                    type="text"
                                                    @input="
                                                        () =>
                                                            updateArrayField(
                                                                field,
                                                                index,
                                                                arrayField,
                                                                arrayItem[
                                                                    arrayField.key
                                                                ],
                                                                {
                                                                    debounce: true,
                                                                },
                                                            )
                                                    "
                                                    @change="
                                                        () =>
                                                            updateArrayField(
                                                                field,
                                                                index,
                                                                arrayField,
                                                                arrayItem[
                                                                    arrayField.key
                                                                ],
                                                            )
                                                    "
                                                    @blur="
                                                        () =>
                                                            updateArrayField(
                                                                field,
                                                                index,
                                                                arrayField,
                                                                arrayItem[
                                                                    arrayField.key
                                                                ],
                                                            )
                                                    "
                                                />
                                            </div>
                                            <NodeTranslateInline
                                                v-if="canTranslateField(arrayField)"
                                                :selected="isTranslationSelected([
                                                    ...pathPrefix,
                                                    field.key,
                                                    index,
                                                    arrayField.key,
                                                ])"
                                                @toggle="
                                                    (selected) =>
                                                        toggleTranslationSelection(
                                                            [
                                                                ...pathPrefix,
                                                                field.key,
                                                                index,
                                                                arrayField.key,
                                                            ],
                                                            arrayField.label,
                                                            selected,
                                                        )
                                                "
                                                @translate="
                                                    () =>
                                                        requestTranslateField(
                                                            [
                                                                ...pathPrefix,
                                                                field.key,
                                                                index,
                                                                arrayField.key,
                                                            ],
                                                            arrayField.label,
                                                        )
                                                "
                                            />
                                        </div>
                                    </template>
                                </label>
                                <div
                                    class="node-panel__array-actions node-panel__array-actions--nested"
                                >
                                    <button
                                        type="button"
                                        class="node-panel__array-remove"
                                        @click="
                                            removeArrayItem(field, index)
                                        "
                                    >
                                        Remove item
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </template>
                <template v-else>
                    <div class="node-panel__field-inline-control">
                        <div class="node-panel__input-wrap">
                            <div
                                v-if="
                                    shouldHighlightText(
                                        objectValue?.[field.key],
                                        field.type,
                                    )
                                "
                                class="node-panel__input-highlight node-panel__input-highlight--single"
                                v-html="getHighlightMarkup(objectValue?.[field.key])"
                                aria-hidden="true"
                            />
                            <input
                                v-model="objectValue[field.key]"
                                type="text"
                                @input="
                                    () =>
                                        applyFieldChange(
                                            field,
                                            objectValue[field.key],
                                            { debounce: true },
                                        )
                                "
                                @change="
                                    () =>
                                        applyFieldChange(
                                            field,
                                            objectValue[field.key],
                                        )
                                "
                                @blur="
                                    () =>
                                        applyFieldChange(
                                            field,
                                            objectValue[field.key],
                                        )
                                "
                            />
                        </div>
                        <NodeTranslateInline
                            v-if="canTranslateField(field)"
                            :selected="isTranslationSelected([...pathPrefix, field.key])"
                            @toggle="
                                (selected) =>
                                    toggleTranslationSelection(
                                        [...pathPrefix, field.key],
                                        field.label,
                                        selected,
                                    )
                            "
                            @translate="
                                () =>
                                    requestTranslateField(
                                        [...pathPrefix, field.key],
                                        field.label,
                                    )
                            "
                        />
                    </div>
                </template>
                <small v-if="fieldErrors?.[field.key]" class="node-panel__error">
                    {{ fieldErrors?.[field.key] }}
                </small>
            </label>
        </div>
    </template>
    <template v-else>
        <div class="node-panel__input-wrap">
            <div
                v-if="shouldHighlightText(jsonValue, highlightType)"
                class="node-panel__input-highlight node-panel__input-highlight--multiline font-mono"
                v-html="getHighlightMarkup(jsonValue)"
                aria-hidden="true"
            />
            <textarea
                class="font-mono"
                :rows="jsonRows"
                :value="jsonValue"
                @input="handleJsonInput"
                @change="handleJsonChange"
                @blur="handleJsonChange"
                @scroll="syncHighlightScroll"
            />
        </div>
    </template>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { ComponentArrayItemField, ComponentPropSchema } from "~/types/builder";
import NodeRemoteSelect from "./NodeRemoteSelect.vue";
import NodeTranslateInline from "./NodeTranslateInline.vue";

type FieldContext = (field: ComponentArrayItemField) => Record<string, any>;

type FieldChangeHandler = (
    schema: ComponentPropSchema | ComponentArrayItemField,
    field: ComponentArrayItemField,
    value: unknown,
    options?: { debounce?: boolean },
) => void;

type JsonChangeHandler = (
    schema: ComponentPropSchema | ComponentArrayItemField,
    value: string,
) => void;

type FieldKeyHandler = (field: ComponentArrayItemField) => string;

type FilterVisibleFields = <
    T extends { key: string; visibleWhen?: unknown },
>(
    fields: T[] | undefined,
    context: Record<string, any> | undefined,
) => T[];

const props = withDefaults(
    defineProps<{
        schema: ComponentPropSchema | ComponentArrayItemField;
        value: Record<string, any> | undefined;
        fieldErrors?: Record<string, string | null>;
        isNested?: boolean;
        pathPrefix?: Array<string | number>;
        fieldKey?: FieldKeyHandler;
        fieldContext?: FieldContext;
        searchQuery?: string;
        filterVisibleFields: FilterVisibleFields;
        shouldHighlightText: (value: unknown, type?: string) => boolean;
        getHighlightMarkup: (value: unknown) => string;
        shouldHighlightSelect: (
            schema: ComponentPropSchema | ComponentArrayItemField,
            value: unknown,
        ) => boolean;
        syncHighlightScroll: (event: Event) => void;
        onFieldChange: FieldChangeHandler;
        onJsonChange: JsonChangeHandler;
        onJsonInput?: JsonChangeHandler;
        jsonValue: string;
        jsonRows?: number;
        jsonHighlightType?: string;
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
    }>(),
    {
        fieldErrors: undefined,
        isNested: false,
        pathPrefix: () => [],
        fieldKey: (field: ComponentArrayItemField) => field.key,
        fieldContext: () => ({}),
        jsonRows: 4,
        jsonHighlightType: undefined,
    },
);

const objectValue = computed(() => props.value as Record<string, any>);
const withSearchContext = (context: Record<string, any>) => ({
    ...context,
    searchQuery: props.searchQuery ?? "",
});

const visibleFields = computed(() =>
    props.filterVisibleFields(props.schema.fields, objectValue.value),
);

const collapsedArrays = ref<Record<string, boolean>>({});

const highlightType = computed(
    () => props.jsonHighlightType ?? props.schema.type,
);

const applyFieldChange = (
    field: ComponentArrayItemField,
    value: unknown,
    options?: { debounce?: boolean },
) => {
    props.onFieldChange(props.schema, field, value, options);
};

const handleJsonInput = (event: Event) => {
    if (!props.onJsonInput) {
        return;
    }
    const target = event.target as HTMLTextAreaElement;
    props.onJsonInput(props.schema, target.value);
};

const handleJsonChange = (event: Event) => {
    const target = event.target as HTMLTextAreaElement;
    props.onJsonChange(props.schema, target.value);
};

const getArrayItems = (field: ComponentArrayItemField) => {
    const current = objectValue.value?.[field.key];
    return Array.isArray(current) ? current : [];
};

const toggleArray = (key: string) => {
    collapsedArrays.value[key] = !collapsedArrays.value[key];
};

const addArrayItem = (field: ComponentArrayItemField) => {
    const next = [...getArrayItems(field), buildArrayItem(field)];
    if (objectValue.value) {
        objectValue.value[field.key] = next;
    }
    applyFieldChange(field, next);
};

const removeArrayItem = (field: ComponentArrayItemField, index: number) => {
    const next = [...getArrayItems(field)];
    next.splice(index, 1);
    if (objectValue.value) {
        objectValue.value[field.key] = next;
    }
    applyFieldChange(field, next);
};

const updateArrayField = (
    field: ComponentArrayItemField,
    index: number,
    arrayField: ComponentArrayItemField,
    value: unknown,
    options?: { debounce?: boolean },
) => {
    const next = [...getArrayItems(field)];
    const item = { ...(next[index] || {}) };
    item[arrayField.key] = value;
    next[index] = item;
    if (objectValue.value) {
        objectValue.value[field.key] = next;
    }
    applyFieldChange(field, next, options);
};

const buildArrayItem = (field: ComponentArrayItemField) => {
    const item: Record<string, unknown> = {};
    (field.items || []).forEach((entry) => {
        if (entry.type === "number") {
            item[entry.key] = 0;
            return;
        }
        if (entry.type === "boolean") {
            item[entry.key] = false;
            return;
        }
        item[entry.key] = "";
    });
    return item;
};

const imageKitTransformFieldKey = (key: string) => `${key}ImagekitTransforms`;

const isImageFieldSchema = (schema: ComponentArrayItemField) =>
    schema.ui?.component === "ContentImageField";

const normalizeImageKitTransformValue = (value: unknown) => {
    if (typeof value !== "string") {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
};

const imageKitTextCompanionField = (
    field: ComponentArrayItemField,
): ComponentArrayItemField => ({
    ...field,
    key: imageKitTransformFieldKey(field.key),
    type: "text",
});

const getImageKitTransformValue = (
    value: Record<string, any> | undefined,
    fieldKey: string,
) => {
    const source = value?.[imageKitTransformFieldKey(fieldKey)];
    return typeof source === "string" ? source : "";
};

const canTranslateField = (
    schema: ComponentPropSchema | ComponentArrayItemField,
): boolean => {
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
