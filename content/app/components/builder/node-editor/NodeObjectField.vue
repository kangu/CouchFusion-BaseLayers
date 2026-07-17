<template>
    <template v-if="schema.fields?.length">
        <div
            class="node-panel__object"
            :class="{ 'node-panel__object--nested': isNested }"
        >
            <label
                v-for="field in visibleFields"
                :key="fieldKey(field)"
                :data-content-prop-path="
                    toPropPathAttr([...pathPrefix, field.key])
                "
                :class="[
                    'node-panel__field',
                    'node-panel__field--nested',
                    {
                        'node-panel__field--match': shouldHighlightSelect(
                            field,
                            objectValue?.[field.key],
                        ),
                        'node-panel__field--localized':
                            canTranslateField(field),
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
                    <NodeBooleanToggle
                        :model-value="Boolean(objectValue?.[field.key])"
                        :label="field.label"
                        @update:model-value="
                            (value) => applyFieldChange(field, value)
                        "
                    />
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
                        :data-content-array-path="
                            toPropPathAttr([...pathPrefix, field.key])
                        "
                    >
                        <div
                            class="node-panel__array-header node-panel__array-header--nested"
                        >
                            <div class="node-panel__array-header-main">
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
                                <span
                                    v-if="collapsedArrays[field.key]"
                                    class="node-panel__array-summary"
                                    :title="formatArraySummary(field)"
                                >
                                    {{ formatArraySummary(field) }}
                                </span>
                            </div>
                            <button
                                type="button"
                                class="node-panel__array-add"
                                @click="openArrayInsertDialog(field)"
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
                                    :data-content-prop-path="
                                        toPropPathAttr([
                                            ...pathPrefix,
                                            field.key,
                                            index,
                                            arrayField.key,
                                        ])
                                    "
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
                                                canTranslateField(arrayField),
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
                                        <NodeBooleanToggle
                                            :model-value="
                                                Boolean(
                                                    arrayItem?.[arrayField.key],
                                                )
                                            "
                                            :label="arrayField.label"
                                            @update:model-value="
                                                (value) =>
                                                    updateArrayField(
                                                        field,
                                                        index,
                                                        arrayField,
                                                        value,
                                                    )
                                            "
                                        />
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
                                    <button
                                        type="button"
                                        class="node-panel__array-reorder-link"
                                        @click="
                                            openArrayReorderDialog(
                                                field,
                                                index,
                                            )
                                        "
                                    >
                                        Move item
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
        <div
            v-if="insertDialog.visible && insertDialog.field"
            class="node-panel__insert-dialog"
        >
            <div
                class="node-panel__insert-backdrop"
                @click="closeArrayInsertDialog"
            ></div>
            <div class="node-panel__insert-content">
                <header class="node-panel__insert-header">
                    <h3>Select insertion point</h3>
                    <button
                        type="button"
                        class="node-panel__insert-close"
                        @click="closeArrayInsertDialog"
                    >
                        ×
                    </button>
                </header>
                <p class="node-panel__insert-subtitle">
                    Choose where to place the new entry.
                </p>
                <ul class="node-panel__insert-options">
                    <li
                        v-for="option in getInsertPositions()"
                        :key="`${insertDialog.field.key}-${option.index}`"
                    >
                        <button
                            type="button"
                            @click="insertArrayItemAt(option.index)"
                        >
                            <strong>Insert here</strong>
                            <span>{{ option.preview }}</span>
                        </button>
                    </li>
                </ul>
            </div>
        </div>
        <NodeReorderDialog
            v-if="reorderDialog.visible"
            :max-index="reorderDialog.maxIndex"
            v-model:newIndex="reorderDialog.newIndex"
            :confirm-reorder-dialog="confirmReorderDialog"
            :close-reorder-dialog="closeReorderDialog"
        />
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
import { computed, nextTick, ref } from "vue";
import type { ComponentArrayItemField, ComponentPropSchema } from "~/types/builder";
import NodeBooleanToggle from "./NodeBooleanToggle.vue";
import NodeRemoteSelect from "./NodeRemoteSelect.vue";
import NodeReorderDialog from "./NodeReorderDialog.vue";
import NodeTranslateInline from "./NodeTranslateInline.vue";
import {
    summarizeArrayValue,
    summarizeNodeEditorValue,
} from "../../../utils/node-editor-summary";

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
const toPropPathAttr = (segments: Array<string | number>) =>
    segments.map((segment) => String(segment)).join(".");

const visibleFields = computed(() =>
    props.filterVisibleFields(props.schema.fields, objectValue.value),
);

const collapsedArrays = ref<Record<string, boolean>>({});
const insertDialog = ref<{
    visible: boolean;
    field: Extract<ComponentArrayItemField, { type: "jsonarray" }> | null;
}>({
    visible: false,
    field: null,
});
const reorderDialog = ref<{
    visible: boolean;
    field: Extract<ComponentArrayItemField, { type: "jsonarray" }> | null;
    currentIndex: number;
    newIndex: number;
    maxIndex: number;
}>({
    visible: false,
    field: null,
    currentIndex: 0,
    newIndex: 1,
    maxIndex: 1,
});

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

const closeArrayInsertDialog = () => {
    insertDialog.value.visible = false;
    insertDialog.value.field = null;
};

const openArrayInsertDialog = (field: ComponentArrayItemField) => {
    if (field.type !== "jsonarray") {
        return;
    }
    insertDialog.value.visible = true;
    insertDialog.value.field = field;
    collapsedArrays.value[field.key] = false;
};

const formatArraySummary = (field: ComponentArrayItemField): string => {
    const fields = field.type === "jsonarray" ? field.items : undefined;
    return summarizeArrayValue(getArrayItems(field), {
        fields,
        maxItems: 3,
        maxLength: 120,
    });
};

const formatArrayItemPreview = (
    value: unknown,
    field?: ComponentArrayItemField,
): string => {
    const fields = field?.type === "jsonarray" ? field.items : undefined;
    return (
        summarizeNodeEditorValue(value, {
            fields,
            maxLength: 96,
        }) || "Empty"
    );
};

const getInsertPositions = () => {
    const field = insertDialog.value.field;
    if (!field) {
        return [] as Array<{ index: number; preview: string }>;
    }
    const items = getArrayItems(field);
    const positions: Array<{ index: number; preview: string }> = [];
    for (let index = 0; index <= items.length; index += 1) {
        const before =
            index > 0 ? formatArrayItemPreview(items[index - 1], field) : "Beginning";
        const after =
            index < items.length ? formatArrayItemPreview(items[index], field) : "End";
        positions.push({ index, preview: `${before} → ${after}` });
    }
    return positions;
};

const insertArrayItemAt = (index: number) => {
    const field = insertDialog.value.field;
    if (!field) {
        return;
    }
    const next = [...getArrayItems(field)];
    next.splice(index, 0, buildArrayItem(field));
    if (objectValue.value) {
        objectValue.value[field.key] = next;
    }
    applyFieldChange(field, next);
    closeArrayInsertDialog();
    const firstFieldKey = field.items?.[0]?.key;
    const path = firstFieldKey
        ? [...props.pathPrefix, field.key, index, firstFieldKey]
        : [...props.pathPrefix, field.key, index];
    void nextTick(() => {
        if (typeof document === "undefined") {
            return;
        }
        const targetPath = toPropPathAttr(path);
        const fieldEl = document.querySelector<HTMLElement>(
            `[data-content-prop-path="${targetPath}"]`,
        );
        if (!fieldEl) {
            return;
        }
        fieldEl.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "nearest",
        });
        const focusTarget = fieldEl.querySelector<HTMLElement>(
            'textarea, input:not([type="checkbox"]):not([type="hidden"]), [contenteditable="true"], .ProseMirror',
        );
        focusTarget?.focus({ preventScroll: true });
        if (
            focusTarget instanceof HTMLInputElement ||
            focusTarget instanceof HTMLTextAreaElement
        ) {
            focusTarget.select();
        }
    });
};

const removeArrayItem = (field: ComponentArrayItemField, index: number) => {
    const next = [...getArrayItems(field)];
    next.splice(index, 1);
    if (objectValue.value) {
        objectValue.value[field.key] = next;
    }
    applyFieldChange(field, next);
};

const openArrayReorderDialog = (
    field: ComponentArrayItemField,
    currentIndex: number,
) => {
    if (field.type !== "jsonarray") {
        return;
    }
    const items = getArrayItems(field);
    reorderDialog.value.visible = true;
    reorderDialog.value.field = field;
    reorderDialog.value.currentIndex = currentIndex;
    reorderDialog.value.newIndex = currentIndex + 1;
    reorderDialog.value.maxIndex = Math.max(items.length, 1);
};

const closeReorderDialog = () => {
    reorderDialog.value.visible = false;
    reorderDialog.value.field = null;
    reorderDialog.value.currentIndex = 0;
    reorderDialog.value.newIndex = 1;
    reorderDialog.value.maxIndex = 1;
};

const confirmReorderDialog = () => {
    if (!reorderDialog.value.visible || !reorderDialog.value.field) {
        return;
    }
    const field = reorderDialog.value.field;
    const items = [...getArrayItems(field)];
    const fromIndex = reorderDialog.value.currentIndex;
    const rawIndex = Number(reorderDialog.value.newIndex);
    if (!Number.isFinite(rawIndex)) {
        return;
    }
    const toIndex = Math.min(
        Math.max(Math.floor(rawIndex), 1),
        reorderDialog.value.maxIndex,
    ) - 1;
    if (
        fromIndex < 0 ||
        fromIndex >= items.length ||
        toIndex < 0 ||
        toIndex >= items.length
    ) {
        closeReorderDialog();
        return;
    }
    if (fromIndex !== toIndex) {
        const [moved] = items.splice(fromIndex, 1);
        items.splice(toIndex, 0, moved);
        if (objectValue.value) {
            objectValue.value[field.key] = items;
        }
        applyFieldChange(field, items);
    }
    closeReorderDialog();
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
