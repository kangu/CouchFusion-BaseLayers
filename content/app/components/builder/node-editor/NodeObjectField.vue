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
                    },
                ]"
            >
                <span>{{ field.label }}</span>
                <template v-if="field.type === 'textarea'">
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
                    <select
                        v-model="objectValue[field.key]"
                        @change="
                            () =>
                                applyFieldChange(
                                    field,
                                    objectValue[field.key],
                                )
                        "
                    >
                        <option disabled value="">Select</option>
                        <option
                            v-for="option in field.options || []"
                            :key="option.value"
                            :value="option.value"
                        >
                            {{ option.label }}
                        </option>
                    </select>
                </template>
                <template v-else-if="field.ui?.component">
                    <component
                        :is="field.ui.component"
                        :model-value="objectValue[field.key]"
                        :prop-definition="field"
                        :field-context="fieldContext(field)"
                        @update:modelValue="
                            (value: unknown) =>
                                applyFieldChange(field, value, {
                                    debounce: true,
                                })
                        "
                    />
                </template>
                <template v-else>
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
import { computed } from "vue";
import type { ComponentArrayItemField, ComponentPropSchema } from "~/types/builder";

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
        fieldKey?: FieldKeyHandler;
        fieldContext?: FieldContext;
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
    }>(),
    {
        fieldErrors: undefined,
        isNested: false,
        fieldKey: (field: ComponentArrayItemField) => field.key,
        fieldContext: () => ({}),
        jsonRows: 4,
        jsonHighlightType: undefined,
    },
);

const objectValue = computed(() => props.value as Record<string, any>);

const visibleFields = computed(() =>
    props.filterVisibleFields(props.schema.fields, objectValue.value),
);

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
</script>
