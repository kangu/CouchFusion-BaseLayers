<template>
    <template v-if="prop.type === 'jsonarray'">
        <div
            class="node-panel__array-item"
            :class="{
                'node-panel__array-item--drag-over':
                    dragOverArrayItem?.propKey === prop.key &&
                    dragOverArrayItem.index === arrayItemEntry.index,
            }"
            draggable="true"
            @dragstart.stop="
                (event) =>
                    handleArrayItemDragStart(
                        prop.key,
                        arrayItemEntry.index,
                        'jsonarray',
                        event,
                    )
            "
            @dragenter.stop.prevent="
                () =>
                    handleArrayItemDragEnter(
                        prop.key,
                        arrayItemEntry.index,
                    )
            "
            @dragover.stop.prevent="
                () =>
                    handleArrayItemDragEnter(
                        prop.key,
                        arrayItemEntry.index,
                    )
            "
            @dragleave.stop="handleArrayItemDragLeave"
            @drop.stop.prevent="
                () =>
                    handleArrayItemDrop(
                        prop.key,
                        arrayItemEntry.index,
                        'jsonarray',
                    )
            "
            @dragend.stop="handleArrayItemDragEnd"
            v-show="!collapsedArrays[prop.key]"
        >
            <div class="node-panel__array-fields">
                <label
                    v-for="field in filterVisibleFields(
                        prop.items,
                        arrayItemEntry.value,
                    )"
                    :key="field.key"
                    :data-content-prop-path="
                        toPropPathAttr([...pathPrefix, field.key])
                    "
                    :class="[
                        'node-panel__field',
                        'node-panel__field--nested',
                        {
                            'node-panel__field--match':
                                shouldHighlightSelect(
                                    field,
                                    arrayItemEntry.value?.[
                                        field.key
                                    ],
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
                                            arrayItemEntry.value?.[
                                                field.key
                                            ],
                                            field.type,
                                        )
                                    "
                                    class="node-panel__input-highlight node-panel__input-highlight--multiline"
                                    v-html="
                                        getHighlightMarkup(
                                            arrayItemEntry.value?.[
                                                field.key
                                            ],
                                        )
                                    "
                                    aria-hidden="true"
                                />
                                <textarea
                                    v-model="
                                        arrayItemEntry.value[
                                            field.key
                                        ]
                                    "
                                    rows="3"
                                    @input="
                                        () =>
                                            handleArrayItemFieldChange(
                                                prop.key,
                                                arrayItemEntry.index,
                                                field,
                                                arrayItemEntry.value[
                                                    field.key
                                                ],
                                                { debounce: true },
                                            )
                                    "
                                    @change="
                                        () =>
                                            handleArrayItemFieldChange(
                                                prop.key,
                                                arrayItemEntry.index,
                                                field,
                                                arrayItemEntry.value[
                                                    field.key
                                                ],
                                            )
                                    "
                                    @blur="
                                        () =>
                                            handleArrayItemFieldChange(
                                                prop.key,
                                                arrayItemEntry.index,
                                                field,
                                                arrayItemEntry.value[
                                                    field.key
                                                ],
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
                                :checked="
                                    Boolean(
                                        arrayItemEntry.value?.[
                                            field.key
                                        ],
                                    )
                                "
                                @change="
                                    (event: Event) =>
                                        handleArrayItemFieldChange(
                                            prop.key,
                                            arrayItemEntry.index,
                                            field,
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
                    <template v-else-if="field.type === 'number'">
                        <input
                            v-model.number="
                                arrayItemEntry.value[field.key]
                            "
                            type="number"
                            @input="
                                () =>
                                    handleArrayItemFieldChange(
                                        prop.key,
                                        arrayItemEntry.index,
                                        field,
                                        arrayItemEntry.value[
                                            field.key
                                        ],
                                        { debounce: true },
                                    )
                            "
                            @change="
                                () =>
                                    handleArrayItemFieldChange(
                                        prop.key,
                                        arrayItemEntry.index,
                                        field,
                                        arrayItemEntry.value[
                                            field.key
                                        ],
                                    )
                            "
                            @blur="
                                () =>
                                    handleArrayItemFieldChange(
                                        prop.key,
                                        arrayItemEntry.index,
                                        field,
                                        arrayItemEntry.value[
                                            field.key
                                        ],
                                    )
                            "
                        />
                    </template>
                    <template v-else-if="field.type === 'select'">
                        <NodeRemoteSelect
                            :schema="field"
                            :model-value="
                                arrayItemEntry.value[field.key]
                            "
                            @update:model-value="
                                (value) => {
                                    arrayItemEntry.value[field.key] = value;
                                    handleArrayItemFieldChange(
                                        prop.key,
                                        arrayItemEntry.index,
                                        field,
                                        value,
                                    );
                                }
                            "
                        />
                    </template>
                    <template v-else-if="field.type === 'stringarray'">
                        <div
                            class="node-panel__array node-panel__array--nested"
                            :data-collapsed="
                                isNestedArrayCollapsed(
                                    prop.key,
                                    arrayItemEntry.index,
                                    field.key,
                                )
                            "
                            :data-content-array-path="
                                toPropPathAttr([...pathPrefix, field.key])
                            "
                        >
                            <div
                                class="node-panel__array-header node-panel__array-header--nested"
                            >
                                <button
                                    type="button"
                                    class="node-panel__array-toggle"
                                    :data-state="
                                        isNestedArrayCollapsed(
                                            prop.key,
                                            arrayItemEntry.index,
                                            field.key,
                                        )
                                            ? 'collapsed'
                                            : 'expanded'
                                    "
                                    @click="
                                        toggleNestedArray(
                                            prop.key,
                                            arrayItemEntry.index,
                                            field.key,
                                        )
                                    "
                                >
                                    {{
                                        isNestedArrayCollapsed(
                                            prop.key,
                                            arrayItemEntry.index,
                                            field.key,
                                        )
                                            ? "Expand"
                                            : "Collapse"
                                    }}
                                    ({{
                                        getArrayItemStringArrayItems(
                                            prop.key,
                                            arrayItemEntry.index,
                                            field,
                                        ).length
                                    }})
                                </button>
                                <button
                                    type="button"
                                    class="node-panel__array-add"
                                    @click="
                                        openArrayItemStringArrayInsertDialog(
                                            prop.key,
                                            arrayItemEntry.index,
                                            field,
                                        )
                                    "
                                >
                                    <span
                                        class="node-panel__array-add-icon"
                                        aria-hidden="true"
                                        >+</span
                                    >
                                </button>
                            </div>
                            <div
                                v-for="nestedEntry in getFilteredArrayItemStringArrayItems(
                                    prop.key,
                                    arrayItemEntry.index,
                                    field,
                                )"
                                :key="`${prop.key}-${arrayItemEntry.index}-${field.key}-string-${nestedEntry.index}`"
                                class="node-panel__array-item node-panel__array-item--nested"
                                v-show="
                                    !isNestedArrayCollapsed(
                                        prop.key,
                                        arrayItemEntry.index,
                                        field.key,
                                    )
                                "
                            >
                                <label
                                    :class="[
                                        'node-panel__field',
                                        'node-panel__field--nested',
                                        {
                                            'node-panel__field--localized':
                                                Boolean(field.localized),
                                        },
                                    ]"
                                >
                                    <span
                                        >{{ field.label }}
                                        {{
                                            nestedEntry.index + 1
                                        }}</span
                                    >
                                    <div class="node-panel__field-inline-control">
                                        <component
                                            v-if="
                                                field.ui?.component
                                            "
                                            :is="field.ui.component"
                                            :model-value="
                                                nestedEntry.value
                                            "
                                            :transform-value="
                                                isImageFieldSchema(field)
                                                    ? getStringArrayTransformValue(
                                                          prop.key,
                                                          arrayItemEntry.index,
                                                          field,
                                                          nestedEntry.index,
                                                      )
                                                    : undefined
                                            "
                                            :prop-definition="field"
                                            :field-context="{
                                                propKey: prop.key,
                                                arrayIndex:
                                                    arrayItemEntry.index,
                                                nestedFieldKey:
                                                    field.key,
                                                searchQuery,
                                            }"
                                            @update:modelValue="
                                                (value: unknown) =>
                                                    handleArrayItemStringArrayChange(
                                                        prop.key,
                                                        arrayItemEntry.index,
                                                        field,
                                                        nestedEntry.index,
                                                        value,
                                                        {
                                                            debounce: true,
                                                        },
                                                    )
                                            "
                                            @update:transformValue="
                                                (value: unknown) =>
                                                    handleArrayItemStringArrayChange(
                                                        prop.key,
                                                        arrayItemEntry.index,
                                                        imageKitStringArrayCompanionField(
                                                            field,
                                                        ),
                                                        nestedEntry.index,
                                                        normalizeImageKitTransformValue(
                                                            value,
                                                        ),
                                                        {
                                                            debounce: true,
                                                        },
                                                    )
                                            "
                                        />
                                        <div class="node-panel__input-wrap">
                                            <div
                                                v-if="
                                                    shouldHighlightText(
                                                        nestedEntry.value,
                                                        field.type,
                                                    )
                                                "
                                                class="node-panel__input-highlight node-panel__input-highlight--single"
                                                v-html="
                                                    getHighlightMarkup(
                                                        nestedEntry.value,
                                                    )
                                                "
                                                aria-hidden="true"
                                            />
                                            <input
                                                :value="nestedEntry.value"
                                                type="text"
                                                @input="
                                                    (
                                                        event: Event,
                                                    ) =>
                                                        handleArrayItemStringArrayChange(
                                                            prop.key,
                                                            arrayItemEntry.index,
                                                            field,
                                                            nestedEntry.index,
                                                            (
                                                                event.target as HTMLInputElement
                                                            ).value,
                                                            {
                                                                debounce: true,
                                                            },
                                                        )
                                                "
                                                @change="
                                                    (
                                                        event: Event,
                                                    ) =>
                                                        handleArrayItemStringArrayChange(
                                                            prop.key,
                                                            arrayItemEntry.index,
                                                            field,
                                                            nestedEntry.index,
                                                            (
                                                                event.target as HTMLInputElement
                                                            ).value,
                                                        )
                                                "
                                                @blur="
                                                    (
                                                        event: Event,
                                                    ) =>
                                                        handleArrayItemStringArrayChange(
                                                            prop.key,
                                                            arrayItemEntry.index,
                                                            field,
                                                            nestedEntry.index,
                                                            (
                                                                event.target as HTMLInputElement
                                                            ).value,
                                                        )
                                                "
                                            />
                                        </div>
                                        <NodeTranslateInline
                                            v-if="canTranslateField(field)"
                                            :selected="isTranslationSelected([
                                                ...pathPrefix,
                                                field.key,
                                                nestedEntry.index,
                                            ])"
                                            @toggle="
                                                (selected) =>
                                                    toggleTranslationSelection(
                                                        [
                                                            ...pathPrefix,
                                                            field.key,
                                                            nestedEntry.index,
                                                        ],
                                                        field.label,
                                                        selected,
                                                    )
                                            "
                                            @translate="
                                                () =>
                                                    requestTranslateField(
                                                        [
                                                            ...pathPrefix,
                                                            field.key,
                                                            nestedEntry.index,
                                                        ],
                                                        field.label,
                                                    )
                                            "
                                        />
                                    </div>
                                </label>
                                <div
                                    class="node-panel__array-actions node-panel__array-actions--nested"
                                >
                                    <button
                                        type="button"
                                        class="node-panel__array-remove"
                                        @click="
                                            confirmRemoveArrayItemStringArrayItem(
                                                prop.key,
                                                arrayItemEntry.index,
                                                field,
                                                nestedEntry.index,
                                            )
                                        "
                                    >
                                        Remove item
                                    </button>
                                    <button
                                        type="button"
                                        class="node-panel__array-reorder-link"
                                        @click="
                                            openArrayItemStringArrayReorderDialog(
                                                prop.key,
                                                arrayItemEntry.index,
                                                field,
                                                nestedEntry.index,
                                            )
                                        "
                                    >
                                        Move (#{{
                                            nestedEntry.index + 1
                                        }})
                                    </button>
                                </div>
                            </div>
                        </div>
                    </template>
                    <template v-else-if="field.ui?.component">
                        <div class="node-panel__field-inline-control">
                            <component
                                :is="field.ui.component"
                                :model-value="
                                    arrayItemEntry.value[field.key]
                                "
                                :transform-value="
                                    isImageFieldSchema(field)
                                        ? getImageKitTransformValue(
                                              arrayItemEntry.value,
                                              field.key,
                                          )
                                        : undefined
                                "
                                :prop-definition="field"
                                :field-context="{
                                    propKey: prop.key,
                                    arrayIndex: arrayItemEntry.index,
                                    searchQuery,
                                }"
                                @update:modelValue="
                                    (value: unknown) =>
                                        handleCustomArrayFieldUpdate(
                                            prop.key,
                                            arrayItemEntry.index,
                                            field,
                                            value,
                                            { debounce: true },
                                        )
                                "
                                @update:transformValue="
                                    (value: unknown) =>
                                        handleCustomArrayFieldUpdate(
                                            prop.key,
                                            arrayItemEntry.index,
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
                            :data-collapsed="
                                isNestedArrayCollapsed(
                                    prop.key,
                                    arrayItemEntry.index,
                                    field.key,
                                )
                            "
                            :data-content-array-path="
                                toPropPathAttr([...pathPrefix, field.key])
                            "
                        >
                            <div
                                class="node-panel__array-header node-panel__array-header--nested"
                            >
                                <button
                                    type="button"
                                    class="node-panel__array-toggle"
                                    :data-state="
                                        isNestedArrayCollapsed(
                                            prop.key,
                                            arrayItemEntry.index,
                                            field.key,
                                        )
                                            ? 'collapsed'
                                            : 'expanded'
                                    "
                                    @click="
                                        toggleNestedArray(
                                            prop.key,
                                            arrayItemEntry.index,
                                            field.key,
                                        )
                                    "
                                >
                                    {{
                                        isNestedArrayCollapsed(
                                            prop.key,
                                            arrayItemEntry.index,
                                            field.key,
                                        )
                                            ? "Expand"
                                            : "Collapse"
                                    }}
                                    ({{
                                        getNestedArrayItems(
                                            prop.key,
                                            arrayItemEntry.index,
                                            field,
                                        ).length
                                    }})
                                </button>
                                <button
                                    type="button"
                                    class="node-panel__array-add"
                                    @click="
                                        openNestedJsonArrayInsertDialog(
                                            prop.key,
                                            arrayItemEntry.index,
                                            field,
                                        )
                                    "
                                >
                                    <span
                                        class="node-panel__array-add-icon"
                                        aria-hidden="true"
                                        >+</span
                                    >
                                </button>
                            </div>
                            <div
                                v-for="(nestedItem, nestedIndex) in getNestedArrayItems(
                                    prop.key,
                                    arrayItemEntry.index,
                                    field,
                                )"
                                :key="`${prop.key}-${arrayItemEntry.index}-${field.key}-${nestedIndex}`"
                                class="node-panel__array-item node-panel__array-item--nested"
                                v-show="
                                    !isNestedArrayCollapsed(
                                        prop.key,
                                        arrayItemEntry.index,
                                        field.key,
                                    ) &&
                                    (!isSearchActive ||
                                        matchesSearch(nestedItem))
                                "
                            >
                                <div
                                    class="node-panel__array-fields node-panel__array-fields--nested"
                                >
                                    <label
                                        v-for="nestedField in filterVisibleFields(
                                            field.items,
                                            nestedItem,
                                        )"
                                        :key="`${field.key}-${nestedField.key}-${nestedIndex}`"
                                        :class="[
                                            'node-panel__field',
                                            'node-panel__field--nested',
                                            {
                                                'node-panel__field--match':
                                                    shouldHighlightSelect(
                                                        nestedField,
                                                        nestedItem?.[
                                                            nestedField.key
                                                        ],
                                                    ),
                                                'node-panel__field--localized':
                                                    Boolean(
                                                        nestedField.localized,
                                                    ),
                                            },
                                        ]"
                                    >
                                        <span>{{
                                            nestedField.label
                                        }}</span>
                                        <template
                                            v-if="
                                                nestedField.type ===
                                                'textarea'
                                            "
                                        >
                                            <div class="node-panel__field-inline-control">
                                                <div
                                                    class="node-panel__input-wrap"
                                                >
                                                    <div
                                                        v-if="
                                                            shouldHighlightText(
                                                                nestedItem[
                                                                    nestedField.key
                                                                ],
                                                                nestedField.type,
                                                            )
                                                        "
                                                        class="node-panel__input-highlight node-panel__input-highlight--multiline"
                                                        v-html="
                                                            getHighlightMarkup(
                                                                nestedItem[
                                                                    nestedField.key
                                                                ],
                                                            )
                                                        "
                                                        aria-hidden="true"
                                                    />
                                                    <textarea
                                                        v-model="
                                                            nestedItem[
                                                                nestedField.key
                                                            ]
                                                        "
                                                        rows="3"
                                                        @input="
                                                            () =>
                                                                updateNestedArrayItemField(
                                                                    prop.key,
                                                                    arrayItemEntry.index,
                                                                    field,
                                                                    nestedIndex,
                                                                    nestedField,
                                                                    nestedItem[
                                                                        nestedField.key
                                                                    ],
                                                                    {
                                                                        debounce: true,
                                                                    },
                                                                )
                                                        "
                                                        @change="
                                                            () =>
                                                                updateNestedArrayItemField(
                                                                    prop.key,
                                                                    arrayItemEntry.index,
                                                                    field,
                                                                    nestedIndex,
                                                                    nestedField,
                                                                    nestedItem[
                                                                        nestedField.key
                                                                    ],
                                                                )
                                                        "
                                                        @blur="
                                                            () =>
                                                                updateNestedArrayItemField(
                                                                    prop.key,
                                                                    arrayItemEntry.index,
                                                                    field,
                                                                    nestedIndex,
                                                                    nestedField,
                                                                    nestedItem[
                                                                        nestedField.key
                                                                    ],
                                                                )
                                                        "
                                                        @scroll="
                                                            syncHighlightScroll
                                                        "
                                                    />
                                                </div>
                                                <NodeTranslateInline
                                                    v-if="canTranslateField(nestedField)"
                                                    :selected="isTranslationSelected([
                                                        ...pathPrefix,
                                                        field.key,
                                                        nestedIndex,
                                                        nestedField.key,
                                                    ])"
                                                    @toggle="
                                                        (selected) =>
                                                            toggleTranslationSelection(
                                                                [
                                                                    ...pathPrefix,
                                                                    field.key,
                                                                    nestedIndex,
                                                                    nestedField.key,
                                                                ],
                                                                nestedField.label,
                                                                selected,
                                                            )
                                                    "
                                                    @translate="
                                                        () =>
                                                            requestTranslateField(
                                                                [
                                                                    ...pathPrefix,
                                                                    field.key,
                                                                    nestedIndex,
                                                                    nestedField.key,
                                                                ],
                                                                nestedField.label,
                                                            )
                                                    "
                                                />
                                            </div>
                                        </template>
                                        <template
                                            v-else-if="
                                                nestedField.type ===
                                                'boolean'
                                            "
                                        >
                                            <span
                                                class="node-panel__checkbox"
                                            >
                                                <input
                                                    type="checkbox"
                                                    class="node-panel__checkbox-input"
                                                    :checked="
                                                        Boolean(
                                                            nestedItem[
                                                                nestedField.key
                                                            ],
                                                        )
                                                    "
                                                    @change="
                                                        (
                                                            event: Event,
                                                        ) =>
                                                            updateNestedArrayItemField(
                                                                prop.key,
                                                                arrayItemEntry.index,
                                                                field,
                                                                nestedIndex,
                                                                nestedField,
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
                                                nestedField.type ===
                                                'number'
                                            "
                                        >
                                            <input
                                                v-model.number="
                                                    nestedItem[
                                                        nestedField.key
                                                    ]
                                                "
                                                type="number"
                                                @input="
                                                    () =>
                                                        updateNestedArrayItemField(
                                                            prop.key,
                                                            arrayItemEntry.index,
                                                            field,
                                                            nestedIndex,
                                                            nestedField,
                                                            nestedItem[
                                                                nestedField.key
                                                            ],
                                                            {
                                                                debounce: true,
                                                            },
                                                        )
                                                "
                                                @change="
                                                    () =>
                                                        updateNestedArrayItemField(
                                                            prop.key,
                                                            arrayItemEntry.index,
                                                            field,
                                                            nestedIndex,
                                                            nestedField,
                                                            nestedItem[
                                                                nestedField.key
                                                            ],
                                                        )
                                                "
                                                @blur="
                                                    () =>
                                                        updateNestedArrayItemField(
                                                            prop.key,
                                                            arrayItemEntry.index,
                                                            field,
                                                            nestedIndex,
                                                            nestedField,
                                                            nestedItem[
                                                                nestedField.key
                                                            ],
                                                        )
                                                "
                                            />
                                        </template>
                                        <template
                                            v-else-if="
                                                nestedField.type ===
                                                'select'
                                            "
                                        >
                                            <NodeRemoteSelect
                                                :schema="nestedField"
                                                :model-value="
                                                    nestedItem[
                                                        nestedField.key
                                                    ]
                                                "
                                                @update:model-value="
                                                    (value) => {
                                                        nestedItem[
                                                            nestedField.key
                                                        ] = value;
                                                        updateNestedArrayItemField(
                                                            prop.key,
                                                            arrayItemEntry.index,
                                                            field,
                                                            nestedIndex,
                                                            nestedField,
                                                            value,
                                                        );
                                                    }
                                                "
                                            />
                                        </template>
                                        <template
                                            v-else-if="
                                                nestedField.ui
                                                    ?.component
                                            "
                                        >
                                            <div class="node-panel__field-inline-control">
                                                <component
                                                    :is="
                                                        nestedField.ui
                                                            .component
                                                    "
                                                    :model-value="
                                                        nestedItem[
                                                            nestedField.key
                                                        ]
                                                    "
                                                    :transform-value="
                                                        isImageFieldSchema(
                                                            nestedField,
                                                        )
                                                            ? getImageKitTransformValue(
                                                                  nestedItem,
                                                                  nestedField.key,
                                                              )
                                                            : undefined
                                                    "
                                                    :prop-definition="
                                                        nestedField
                                                    "
                                                    :field-context="{
                                                        propKey:
                                                            prop.key,
                                                        arrayIndex:
                                                            arrayItemEntry.index,
                                                        nestedIndex,
                                                        nestedFieldKey:
                                                            nestedField.key,
                                                        searchQuery,
                                                    }"
                                                    @update:modelValue="
                                                        (
                                                            value: unknown,
                                                        ) =>
                                                            updateCustomNestedArrayItemField(
                                                                prop.key,
                                                                arrayItemEntry.index,
                                                                field,
                                                                nestedIndex,
                                                                nestedField,
                                                                value,
                                                                {
                                                                    debounce: true,
                                                                },
                                                            )
                                                    "
                                                    @update:transformValue="
                                                        (
                                                            value: unknown,
                                                        ) =>
                                                            updateCustomNestedArrayItemField(
                                                                prop.key,
                                                                arrayItemEntry.index,
                                                                field,
                                                                nestedIndex,
                                                                imageKitTextCompanionField(
                                                                    nestedField,
                                                                ),
                                                                normalizeImageKitTransformValue(
                                                                    value,
                                                                ),
                                                                {
                                                                    debounce: true,
                                                                },
                                                            )
                                                    "
                                                />
                                                <NodeTranslateInline
                                                    v-if="canTranslateField(nestedField)"
                                                    :selected="isTranslationSelected([
                                                        ...pathPrefix,
                                                        field.key,
                                                        nestedIndex,
                                                        nestedField.key,
                                                    ])"
                                                    @toggle="
                                                        (selected) =>
                                                            toggleTranslationSelection(
                                                                [
                                                                    ...pathPrefix,
                                                                    field.key,
                                                                    nestedIndex,
                                                                    nestedField.key,
                                                                ],
                                                                nestedField.label,
                                                                selected,
                                                            )
                                                    "
                                                    @translate="
                                                        () =>
                                                            requestTranslateField(
                                                                [
                                                                    ...pathPrefix,
                                                                    field.key,
                                                                    nestedIndex,
                                                                    nestedField.key,
                                                                ],
                                                                nestedField.label,
                                                            )
                                                    "
                                                />
                                            </div>
                                        </template>
                                        <template
                                            v-else-if="
                                                nestedField.type ===
                                                'stringarray'
                                            "
                                        >
                                            <div
                                                class="node-panel__array node-panel__array--nested"
                                                :data-collapsed="
                                                    isNestedArrayCollapsed(
                                                        prop.key,
                                                        arrayItemEntry.index,
                                                        `${field.key}-${nestedField.key}`,
                                                        nestedIndex,
                                                    )
                                                "
                                                :data-content-array-path="
                                                    toPropPathAttr([
                                                        ...pathPrefix,
                                                        field.key,
                                                        nestedIndex,
                                                        nestedField.key,
                                                    ])
                                                "
                                            >
                                                <div
                                                    class="node-panel__array-header node-panel__array-header--nested"
                                                >
                                                    <button
                                                        type="button"
                                                        class="node-panel__array-toggle"
                                                        :data-state="
                                                            isNestedArrayCollapsed(
                                                                prop.key,
                                                                arrayItemEntry.index,
                                                                `${field.key}-${nestedField.key}`,
                                                                nestedIndex,
                                                            )
                                                                ? 'collapsed'
                                                                : 'expanded'
                                                        "
                                                        @click="
                                                            toggleNestedArray(
                                                                prop.key,
                                                                arrayItemEntry.index,
                                                                `${field.key}-${nestedField.key}`,
                                                                nestedIndex,
                                                            )
                                                        "
                                                    >
                                                        {{
                                                            isNestedArrayCollapsed(
                                                                prop.key,
                                                                arrayItemEntry.index,
                                                                `${field.key}-${nestedField.key}`,
                                                                nestedIndex,
                                                            )
                                                                ? "Expand"
                                                                : "Collapse"
                                                        }}
                                                        ({{
                                                            getNestedArrayItemStringArrayItems(
                                                                prop.key,
                                                                arrayItemEntry.index,
                                                                field,
                                                                nestedIndex,
                                                                nestedField,
                                                            ).length
                                                        }})
                                                    </button>
                                                    <button
                                                        type="button"
                                                        class="node-panel__array-add"
                                                        @click="
                                                            openNestedStringArrayInsertDialog(
                                                                prop.key,
                                                                arrayItemEntry.index,
                                                                field,
                                                                nestedIndex,
                                                                nestedField,
                                                            )
                                                        "
                                                    >
                                                        <span
                                                            class="node-panel__array-add-icon"
                                                            aria-hidden="true"
                                                            >+</span
                                                        >
                                                    </button>
                                                </div>
                                                <div
                                                    v-for="nestedEntry in getNestedArrayItemStringArrayItems(
                                                        prop.key,
                                                        arrayItemEntry.index,
                                                        field,
                                                        nestedIndex,
                                                        nestedField,
                                                    )"
                                                    :key="`${prop.key}-${arrayItemEntry.index}-${field.key}-${nestedField.key}-${nestedIndex}-${nestedEntry.index}`"
                                                    class="node-panel__array-item node-panel__array-item--nested"
                                                    v-show="
                                                        !isNestedArrayCollapsed(
                                                            prop.key,
                                                            arrayItemEntry.index,
                                                            `${field.key}-${nestedField.key}`,
                                                            nestedIndex,
                                                        )
                                                    "
                                                >
                                                    <label
                                                        :class="[
                                                            'node-panel__field',
                                                            'node-panel__field--nested',
                                                            {
                                                                'node-panel__field--localized':
                                                                    Boolean(
                                                                        nestedField.localized,
                                                                    ),
                                                            },
                                                        ]"
                                                    >
                                                        <span
                                                            >{{
                                                                nestedField.label
                                                            }}
                                                            {{
                                                                nestedEntry.index +
                                                                1
                                                            }}</span
                                                        >
                                                        <div class="node-panel__field-inline-control">
                                                            <component
                                                                v-if="
                                                                    nestedField.ui
                                                                        ?.component
                                                                "
                                                                :is="
                                                                    nestedField.ui
                                                                        .component
                                                                "
                                                                :model-value="
                                                                    nestedEntry.value
                                                                "
                                                                :transform-value="
                                                                    isImageFieldSchema(
                                                                        nestedField,
                                                                    )
                                                                        ? getNestedStringArrayTransformValue(
                                                                              prop.key,
                                                                              arrayItemEntry.index,
                                                                              field,
                                                                              nestedIndex,
                                                                              nestedField,
                                                                              nestedEntry.index,
                                                                          )
                                                                        : undefined
                                                                "
                                                                :prop-definition="
                                                                    nestedField
                                                                "
                                                                :field-context="{
                                                                    propKey:
                                                                        prop.key,
                                                                    arrayIndex:
                                                                        arrayItemEntry.index,
                                                                    nestedIndex,
                                                                    nestedFieldKey:
                                                                        nestedField.key,
                                                                    nestedEntryIndex:
                                                                        nestedEntry.index,
                                                                    searchQuery,
                                                                }"
                                                                @update:modelValue="
                                                                    (
                                                                        value: unknown,
                                                                    ) =>
                                                                        handleNestedArrayItemStringArrayChange(
                                                                            prop.key,
                                                                            arrayItemEntry.index,
                                                                            field,
                                                                            nestedIndex,
                                                                            nestedField,
                                                                            nestedEntry.index,
                                                                            value,
                                                                            {
                                                                                debounce: true,
                                                                            },
                                                                        )
                                                                "
                                                                @update:transformValue="
                                                                    (
                                                                        value: unknown,
                                                                    ) =>
                                                                        handleNestedArrayItemStringArrayChange(
                                                                            prop.key,
                                                                            arrayItemEntry.index,
                                                                            field,
                                                                            nestedIndex,
                                                                            imageKitStringArrayCompanionField(
                                                                                nestedField,
                                                                            ),
                                                                            nestedEntry.index,
                                                                            normalizeImageKitTransformValue(
                                                                                value,
                                                                            ),
                                                                            {
                                                                                debounce: true,
                                                                            },
                                                                        )
                                                                "
                                                            />
                                                            <div
                                                                class="node-panel__input-wrap"
                                                            >
                                                                <div
                                                                    v-if="
                                                                        shouldHighlightText(
                                                                            nestedEntry.value,
                                                                            nestedField.type,
                                                                        )
                                                                    "
                                                                    class="node-panel__input-highlight node-panel__input-highlight--single"
                                                                    v-html="
                                                                        getHighlightMarkup(
                                                                            nestedEntry.value,
                                                                        )
                                                                    "
                                                                    aria-hidden="true"
                                                                />
                                                                <input
                                                                    :value="
                                                                        nestedEntry.value
                                                                    "
                                                                    type="text"
                                                                    @input="
                                                                        (
                                                                            event: Event,
                                                                        ) =>
                                                                            handleNestedArrayItemStringArrayChange(
                                                                                prop.key,
                                                                                arrayItemEntry.index,
                                                                                field,
                                                                                nestedIndex,
                                                                                nestedField,
                                                                                nestedEntry.index,
                                                                                (
                                                                                    event.target as HTMLInputElement
                                                                                )
                                                                                    .value,
                                                                                {
                                                                                    debounce: true,
                                                                                },
                                                                            )
                                                                    "
                                                                    @change="
                                                                        (
                                                                            event: Event,
                                                                        ) =>
                                                                            handleNestedArrayItemStringArrayChange(
                                                                                prop.key,
                                                                                arrayItemEntry.index,
                                                                                field,
                                                                                nestedIndex,
                                                                                nestedField,
                                                                                nestedEntry.index,
                                                                                (
                                                                                    event.target as HTMLInputElement
                                                                                )
                                                                                    .value,
                                                                            )
                                                                    "
                                                                    @blur="
                                                                        (
                                                                            event: Event,
                                                                        ) =>
                                                                            handleNestedArrayItemStringArrayChange(
                                                                                prop.key,
                                                                                arrayItemEntry.index,
                                                                                field,
                                                                                nestedIndex,
                                                                                nestedField,
                                                                                nestedEntry.index,
                                                                                (
                                                                                    event.target as HTMLInputElement
                                                                                )
                                                                                    .value,
                                                                            )
                                                                    "
                                                                />
                                                            </div>
                                                            <NodeTranslateInline
                                                                v-if="canTranslateField(nestedField)"
                                                                :selected="isTranslationSelected([
                                                                    ...pathPrefix,
                                                                    field.key,
                                                                    nestedIndex,
                                                                    nestedField.key,
                                                                    nestedEntry.index,
                                                                ])"
                                                                @toggle="
                                                                    (selected) =>
                                                                        toggleTranslationSelection(
                                                                            [
                                                                                ...pathPrefix,
                                                                                field.key,
                                                                                nestedIndex,
                                                                                nestedField.key,
                                                                                nestedEntry.index,
                                                                            ],
                                                                            nestedField.label,
                                                                            selected,
                                                                        )
                                                                "
                                                                @translate="
                                                                    () =>
                                                                        requestTranslateField(
                                                                            [
                                                                                ...pathPrefix,
                                                                                field.key,
                                                                                nestedIndex,
                                                                                nestedField.key,
                                                                                nestedEntry.index,
                                                                            ],
                                                                            nestedField.label,
                                                                        )
                                                                "
                                                            />
                                                        </div>
                                                    </label>
                                                    <div
                                                        class="node-panel__array-actions node-panel__array-actions--nested"
                                                    >
                                                        <button
                                                            type="button"
                                                            class="node-panel__array-remove"
                                                            @click="
                                                                confirmRemoveNestedArrayItemStringArrayItem(
                                                                    prop.key,
                                                                    arrayItemEntry.index,
                                                                    field,
                                                                    nestedIndex,
                                                                    nestedField,
                                                                    nestedEntry.index,
                                                                )
                                                            "
                                                        >
                                                            Remove
                                                            item
                                                        </button>
                                                        <button
                                                            type="button"
                                                            class="node-panel__array-reorder-link"
                                                            @click="
                                                                openNestedStringArrayReorderDialog(
                                                                    prop.key,
                                                                    arrayItemEntry.index,
                                                                    field,
                                                                    nestedIndex,
                                                                    nestedField,
                                                                    nestedEntry.index,
                                                                )
                                                            "
                                                        >
                                                            Move
                                                            (#{{
                                                                nestedEntry.index +
                                                                1
                                                            }})
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </template>
                                        <template v-else-if="nestedField.type === 'jsonobject'">
                                            <NodeObjectField
                                                :schema="nestedField"
                                                :value="getNestedArrayItemObjectValue(
                                                    prop.key,
                                                    arrayItemEntry.index,
                                                    field,
                                                    nestedIndex,
                                                    nestedField,
                                                )"
                                                :is-nested="true"
                                                :path-prefix="[
                                                    ...pathPrefix,
                                                    field.key,
                                                    nestedIndex,
                                                    nestedField.key,
                                                ]"
                                                :field-key="(objectField) => `${prop.key}-${arrayItemEntry.index}-${nestedField.key}-${objectField.key}-${nestedIndex}`"
                                                :field-context="() => ({ propKey: prop.key, arrayIndex: arrayItemEntry.index, nestedIndex, nestedFieldKey: nestedField.key, searchQuery })"
                                                :filter-visible-fields="filterVisibleFields"
                                                :should-highlight-text="shouldHighlightText"
                                                :get-highlight-markup="getHighlightMarkup"
                                                :should-highlight-select="shouldHighlightSelect"
                                                :sync-highlight-scroll="syncHighlightScroll"
                                                :search-query="searchQuery"
                                                :on-field-change="(schema, objectField, value, options) =>
                                                    handleNestedArrayItemObjectFieldChange(
                                                        prop.key,
                                                        arrayItemEntry.index,
                                                        field,
                                                        nestedIndex,
                                                        schema,
                                                        objectField,
                                                        value,
                                                        options,
                                                    )"
                                                :on-json-change="(schema, value) =>
                                                    handleNestedArrayItemObjectJsonChange(
                                                        prop.key,
                                                        arrayItemEntry.index,
                                                        field,
                                                        nestedIndex,
                                                        schema,
                                                        value,
                                                    )"
                                                :json-value="formatJsonValue(
                                                    getNestedArrayItemObjectValue(
                                                        prop.key,
                                                        arrayItemEntry.index,
                                                        field,
                                                        nestedIndex,
                                                        nestedField,
                                                    ),
                                                )"
                                                :json-rows="4"
                                                json-highlight-type="json"
                                                :on-translate-field="onTranslateField"
                                                :on-toggle-translate-selection="onToggleTranslateSelection"
                                                :is-translate-selected="isTranslateSelected"
                                            />
                                        </template>
                                        <template v-else>
                                            <div class="node-panel__field-inline-control">
                                                <div
                                                    class="node-panel__input-wrap"
                                                >
                                                    <div
                                                        v-if="
                                                            shouldHighlightText(
                                                                nestedItem[
                                                                    nestedField.key
                                                                ],
                                                                nestedField.type,
                                                            )
                                                        "
                                                        class="node-panel__input-highlight node-panel__input-highlight--single"
                                                        v-html="
                                                            getHighlightMarkup(
                                                                nestedItem[
                                                                    nestedField.key
                                                                ],
                                                            )
                                                        "
                                                        aria-hidden="true"
                                                    />
                                                    <input
                                                        v-model="
                                                            nestedItem[
                                                                nestedField.key
                                                            ]
                                                        "
                                                        type="text"
                                                        @input="
                                                            () =>
                                                                updateNestedArrayItemField(
                                                                    prop.key,
                                                                    arrayItemEntry.index,
                                                                    field,
                                                                    nestedIndex,
                                                                    nestedField,
                                                                    nestedItem[
                                                                        nestedField.key
                                                                    ],
                                                                    {
                                                                        debounce: true,
                                                                    },
                                                                )
                                                        "
                                                        @change="
                                                            () =>
                                                                updateNestedArrayItemField(
                                                                    prop.key,
                                                                    arrayItemEntry.index,
                                                                    field,
                                                                    nestedIndex,
                                                                    nestedField,
                                                                    nestedItem[
                                                                        nestedField.key
                                                                    ],
                                                                )
                                                        "
                                                        @blur="
                                                            () =>
                                                                updateNestedArrayItemField(
                                                                    prop.key,
                                                                    arrayItemEntry.index,
                                                                    field,
                                                                    nestedIndex,
                                                                    nestedField,
                                                                    nestedItem[
                                                                        nestedField.key
                                                                    ],
                                                                )
                                                        "
                                                    />
                                                </div>
                                                <NodeTranslateInline
                                                    v-if="canTranslateField(nestedField)"
                                                    :selected="isTranslationSelected([
                                                        ...pathPrefix,
                                                        field.key,
                                                        nestedIndex,
                                                        nestedField.key,
                                                    ])"
                                                    @toggle="
                                                        (selected) =>
                                                            toggleTranslationSelection(
                                                                [
                                                                    ...pathPrefix,
                                                                    field.key,
                                                                    nestedIndex,
                                                                    nestedField.key,
                                                                ],
                                                                nestedField.label,
                                                                selected,
                                                            )
                                                    "
                                                    @translate="
                                                        () =>
                                                            requestTranslateField(
                                                                [
                                                                    ...pathPrefix,
                                                                    field.key,
                                                                    nestedIndex,
                                                                    nestedField.key,
                                                                ],
                                                                nestedField.label,
                                                            )
                                                    "
                                                />
                                            </div>
                                        </template>
                                    </label>
                                </div>
                                <div
                                    class="node-panel__array-actions node-panel__array-actions--nested"
                                >
                                    <button
                                        type="button"
                                        class="node-panel__array-remove"
                                        @click="
                                            confirmRemoveNestedArrayItem(
                                                prop.key,
                                                arrayItemEntry.index,
                                                field,
                                                nestedIndex,
                                            )
                                        "
                                    >
                                        Remove item
                                    </button>
                                    <button
                                        type="button"
                                        class="node-panel__array-reorder-link"
                                        @click="
                                            openNestedJsonArrayReorderDialog(
                                                prop.key,
                                                arrayItemEntry.index,
                                                field,
                                                nestedIndex,
                                            )
                                        "
                                    >
                                        Move (#{{
                                            nestedIndex + 1
                                        }})
                                    </button>
                                </div>
                            </div>
                        </div>
                    </template>
                    <template v-else-if="field.type === 'jsonobject'">
                        <NodeObjectField
                            :schema="field"
                            :value="getArrayItemObjectValue(prop.key, arrayItemEntry.index, field)"
                            :is-nested="true"
                            :path-prefix="[
                                ...pathPrefix,
                                field.key,
                            ]"
                            :field-key="(nestedObjectField) => `${prop.key}-${arrayItemEntry.index}-${field.key}-${nestedObjectField.key}`"
                            :field-context="() => ({ propKey: prop.key, arrayIndex: arrayItemEntry.index, nestedFieldKey: field.key, searchQuery })"
                            :filter-visible-fields="filterVisibleFields"
                            :should-highlight-text="shouldHighlightText"
                            :get-highlight-markup="getHighlightMarkup"
                            :should-highlight-select="shouldHighlightSelect"
                            :sync-highlight-scroll="syncHighlightScroll"
                            :search-query="searchQuery"
                            :on-field-change="(schema, nestedObjectField, value, options) =>
                                handleArrayItemObjectFieldChange(
                                    prop.key,
                                    arrayItemEntry.index,
                                    schema,
                                    nestedObjectField,
                                    value,
                                    options,
                                )"
                            :on-json-change="(schema, value) =>
                                handleArrayItemObjectJsonChange(
                                    prop.key,
                                    arrayItemEntry.index,
                                    schema,
                                    value,
                                )"
                            :json-value="formatJsonValue(
                                getArrayItemObjectValue(
                                    prop.key,
                                    arrayItemEntry.index,
                                    field,
                                ),
                            )"
                            :json-rows="4"
                            json-highlight-type="json"
                            :on-translate-field="onTranslateField"
                            :on-toggle-translate-selection="onToggleTranslateSelection"
                            :is-translate-selected="isTranslateSelected"
                        />
                    </template>
                    <template v-else>
                        <div class="node-panel__field-inline-control">
                            <div class="node-panel__input-wrap">
                                <div
                                    v-if="
                                        shouldHighlightText(
                                            arrayItemEntry.value?.[
                                                field.key
                                            ],
                                            field.type,
                                        )
                                    "
                                    class="node-panel__input-highlight node-panel__input-highlight--single"
                                    v-html="
                                        getHighlightMarkup(
                                            arrayItemEntry.value?.[
                                                field.key
                                            ],
                                        )
                                    "
                                    aria-hidden="true"
                                />
                                <input
                                    v-model="
                                        arrayItemEntry.value[field.key]
                                    "
                                    type="text"
                                    @input="
                                        () =>
                                            handleArrayItemFieldChange(
                                                prop.key,
                                                arrayItemEntry.index,
                                                field,
                                                arrayItemEntry.value[
                                                    field.key
                                                ],
                                                { debounce: true },
                                            )
                                    "
                                    @change="
                                        () =>
                                            handleArrayItemFieldChange(
                                                prop.key,
                                                arrayItemEntry.index,
                                                field,
                                                arrayItemEntry.value[
                                                    field.key
                                                ],
                                            )
                                    "
                                    @blur="
                                        () =>
                                            handleArrayItemFieldChange(
                                                prop.key,
                                                arrayItemEntry.index,
                                                field,
                                                arrayItemEntry.value[
                                                    field.key
                                                ],
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
                </label>
            </div>
            <div class="node-panel__array-actions">
                <button
                    type="button"
                    class="node-panel__array-remove"
                    @click="
                        confirmRemoveArrayItem(
                            prop.key,
                            arrayItemEntry.index,
                        )
                    "
                >
                    Remove item
                </button>
                <button
                    type="button"
                    class="node-panel__array-reorder-link"
                    @click="
                        openTopLevelArrayReorderDialog(
                            prop.key,
                            'jsonarray',
                            arrayItemEntry.index,
                        )
                    "
                >
                    Move (#{{ arrayItemEntry.index + 1 }})
                </button>
            </div>
        </div>
    </template>
    <template v-else-if="prop.type === 'stringarray'">
        <div
            class="node-panel__array-item"
            :class="{
                'node-panel__array-item--drag-over':
                    dragOverArrayItem?.propKey === prop.key &&
                    dragOverArrayItem.index === stringEntry.index,
            }"
            draggable="true"
            @dragstart.stop="
                (event) =>
                    handleArrayItemDragStart(
                        prop.key,
                        stringEntry.index,
                        'stringarray',
                        event,
                    )
            "
            @dragenter.stop.prevent="
                () =>
                    handleArrayItemDragEnter(
                        prop.key,
                        stringEntry.index,
                    )
            "
            @dragover.stop.prevent="
                () =>
                    handleArrayItemDragEnter(
                        prop.key,
                        stringEntry.index,
                    )
            "
            @dragleave.stop="handleArrayItemDragLeave"
            @drop.stop.prevent="
                () =>
                    handleArrayItemDrop(
                        prop.key,
                        stringEntry.index,
                        'stringarray',
                    )
            "
            @dragend.stop="handleArrayItemDragEnd"
            v-show="!collapsedArrays[prop.key]"
        >
            <label
                :data-content-prop-path="toPropPathAttr(pathPrefix)"
                :class="[
                    'node-panel__field',
                    {
                        'node-panel__field--localized': Boolean(
                            prop.localized,
                        ),
                    },
                ]"
            >
                <span>{{ prop.label }} {{ stringEntry.index + 1 }}</span>
                <div class="node-panel__field-inline-control">
                    <component
                        v-if="prop.ui?.component"
                        :is="prop.ui.component"
                        :model-value="
                            propDraft[prop.key][stringEntry.index]
                        "
                        :transform-value="
                            isImageFieldSchema(prop)
                                ? getTopLevelStringArrayTransformValue(
                                      prop.key,
                                      stringEntry.index,
                                  )
                                : undefined
                        "
                        :prop-definition="prop"
                        :field-context="{
                            propKey: prop.key,
                            arrayIndex: stringEntry.index,
                            searchQuery,
                        }"
                        @update:modelValue="
                            (value: unknown) =>
                                handleStringArrayChange(
                                    prop.key,
                                    stringEntry.index,
                                    value,
                                    { debounce: true },
                                )
                        "
                        @update:transformValue="
                            (value: unknown) =>
                                handleStringArrayChange(
                                    imageKitTransformFieldKey(prop.key),
                                    stringEntry.index,
                                    normalizeImageKitTransformValue(value),
                                    { debounce: true },
                                )
                        "
                    />
                    <div v-else class="node-panel__input-wrap">
                        <div
                            v-if="
                                shouldHighlightText(
                                    propDraft[prop.key]?.[
                                        stringEntry.index
                                    ],
                                    prop.type,
                                )
                            "
                            class="node-panel__input-highlight node-panel__input-highlight--single"
                            v-html="
                                getHighlightMarkup(
                                    propDraft[prop.key]?.[
                                        stringEntry.index
                                    ],
                                )
                            "
                            aria-hidden="true"
                        />
                        <input
                            v-model="
                                propDraft[prop.key][stringEntry.index]
                            "
                            type="text"
                            @input="
                                () =>
                                    handleStringArrayChange(
                                        prop.key,
                                        stringEntry.index,
                                        propDraft[prop.key][
                                            stringEntry.index
                                        ],
                                        { debounce: true },
                                    )
                            "
                            @change="
                                () =>
                                    handleStringArrayChange(
                                        prop.key,
                                        stringEntry.index,
                                        propDraft[prop.key][
                                            stringEntry.index
                                        ],
                                    )
                            "
                            @blur="
                                () =>
                                    handleStringArrayChange(
                                        prop.key,
                                        stringEntry.index,
                                        propDraft[prop.key][
                                            stringEntry.index
                                        ],
                                    )
                            "
                        />
                    </div>
                    <NodeTranslateInline
                        v-if="canTranslateField(prop)"
                        :selected="isTranslationSelected([...pathPrefix])"
                        @toggle="
                            (selected) =>
                                toggleTranslationSelection(
                                    [...pathPrefix],
                                    prop.label,
                                    selected,
                                )
                        "
                        @translate="
                            () =>
                                requestTranslateField(
                                    [...pathPrefix],
                                    prop.label,
                                )
                        "
                    />
                </div>
            </label>
            <div class="node-panel__array-actions">
                <button
                    type="button"
                    class="node-panel__array-remove"
                    @click="
                        confirmRemoveStringArrayItem(
                            prop.key,
                            stringEntry.index,
                        )
                    "
                >
                    Remove item
                </button>
                <button
                    type="button"
                    class="node-panel__array-reorder-link"
                    @click="
                        openTopLevelArrayReorderDialog(
                            prop.key,
                            'stringarray',
                            stringEntry.index,
                        )
                    "
                >
                    Move (#{{ stringEntry.index + 1 }})
                </button>
            </div>
        </div>
    </template>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ComponentArrayItemField, ComponentPropSchema } from "~/types/builder";
import NodeObjectField from "./NodeObjectField.vue";
import NodeRemoteSelect from "./NodeRemoteSelect.vue";
import NodeTranslateInline from "./NodeTranslateInline.vue";

type AnyHandler = (...args: any[]) => void;
type DragOverArrayItem = { propKey: string; index: number } | null;

const props = defineProps<{
    prop: ComponentPropSchema;
    entry: { value: any; index: number };
    pathPrefix: Array<string | number>;
    propDraft: Record<string, any>;
    collapsedArrays: Record<string, boolean>;
    dragOverArrayItem: DragOverArrayItem;
    isSearchActive: boolean;
    searchQuery?: string;
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
    getArrayItemStringArrayItems: AnyHandler;
    getFilteredArrayItemStringArrayItems: AnyHandler;
    getNestedArrayItems: AnyHandler;
    getNestedArrayItemStringArrayItems: AnyHandler;
    getArrayItemObjectValue: AnyHandler;
    getNestedArrayItemObjectValue: AnyHandler;
    addArrayItemStringArrayItem: AnyHandler;
    addNestedArrayItem: AnyHandler;
    addNestedArrayItemStringArrayItem: AnyHandler;
    removeArrayItem: AnyHandler;
    removeStringArrayItem: AnyHandler;
    removeArrayItemStringArrayItem: AnyHandler;
    removeNestedArrayItem: AnyHandler;
    removeNestedArrayItemStringArrayItem: AnyHandler;
    isNestedArrayCollapsed: AnyHandler;
    toggleNestedArray: AnyHandler;
    openArrayItemStringArrayInsertDialog: AnyHandler;
    openNestedJsonArrayInsertDialog: AnyHandler;
    openNestedStringArrayInsertDialog: AnyHandler;
    openTopLevelArrayReorderDialog: AnyHandler;
    openArrayItemStringArrayReorderDialog: AnyHandler;
    openNestedJsonArrayReorderDialog: AnyHandler;
    openNestedStringArrayReorderDialog: AnyHandler;
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

const arrayItemEntry = computed(() => props.entry);
const stringEntry = computed(() => props.entry);
const toPropPathAttr = (segments: Array<string | number>) =>
    segments.map((segment) => String(segment)).join(".");

const imageKitTransformFieldKey = (key: string) => `${key}ImagekitTransforms`;

const isImageFieldSchema = (
    schema: ComponentArrayItemField | ComponentPropSchema,
) => schema.ui?.component === "ContentImageField";

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

const imageKitStringArrayCompanionField = (
    field: Extract<ComponentArrayItemField, { type: "stringarray" }>,
): Extract<ComponentArrayItemField, { type: "stringarray" }> => ({
    ...field,
    key: imageKitTransformFieldKey(field.key),
});

const getImageKitTransformValue = (
    value: Record<string, any> | undefined,
    fieldKey: string,
) => {
    const source = value?.[imageKitTransformFieldKey(fieldKey)];
    return typeof source === "string" ? source : "";
};

const getTopLevelStringArrayTransformValue = (
    propKey: string,
    index: number,
) => {
    const source = props.propDraft?.[imageKitTransformFieldKey(propKey)];
    return Array.isArray(source) ? String(source[index] ?? "") : "";
};

const getStringArrayTransformValue = (
    propKey: string,
    parentIndex: number,
    field: Extract<ComponentArrayItemField, { type: "stringarray" }>,
    index: number,
) => {
    const companion = imageKitStringArrayCompanionField(field);
    const items = props.getArrayItemStringArrayItems(
        propKey,
        parentIndex,
        companion,
    );
    return Array.isArray(items) ? String(items[index] ?? "") : "";
};

const getNestedStringArrayTransformValue = (
    propKey: string,
    parentIndex: number,
    field: Extract<ComponentArrayItemField, { type: "jsonarray" }>,
    nestedIndex: number,
    nestedField: Extract<ComponentArrayItemField, { type: "stringarray" }>,
    index: number,
) => {
    const companion = imageKitStringArrayCompanionField(nestedField);
    const items = props.getNestedArrayItemStringArrayItems(
        propKey,
        parentIndex,
        field,
        nestedIndex,
        companion,
    );
    return Array.isArray(items) ? String(items[index] ?? "") : "";
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

const shouldConfirmRemoval = () => {
    if (typeof window === "undefined") {
        return true;
    }

    return window.confirm("Remove this item? This action cannot be undone.");
};

const confirmRemoveArrayItem = (...args: any[]) => {
    if (!shouldConfirmRemoval()) {
        return;
    }
    props.removeArrayItem(...args);
};

const confirmRemoveStringArrayItem = (...args: any[]) => {
    if (!shouldConfirmRemoval()) {
        return;
    }
    props.removeStringArrayItem(...args);
};

const confirmRemoveArrayItemStringArrayItem = (...args: any[]) => {
    if (!shouldConfirmRemoval()) {
        return;
    }
    props.removeArrayItemStringArrayItem(...args);
};

const confirmRemoveNestedArrayItem = (...args: any[]) => {
    if (!shouldConfirmRemoval()) {
        return;
    }
    props.removeNestedArrayItem(...args);
};

const confirmRemoveNestedArrayItemStringArrayItem = (...args: any[]) => {
    if (!shouldConfirmRemoval()) {
        return;
    }
    props.removeNestedArrayItemStringArrayItem(...args);
};
</script>
