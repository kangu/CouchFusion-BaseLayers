<template>
    <div
        ref="panelRef"
        class="node-panel"
        :class="{
            'node-panel--global-alias': isGlobalAliasNode,
            'node-panel--isolated': isolateLayout,
        }"
        :data-builder-node-uid="node.uid"
        :style="{ marginLeft: isolateLayout ? '0px' : depth * 16 + 'px' }"
        @focusin="notifyFocus"
        @click="notifyFocus"
    >
        <div
            v-if="node.type === 'component' && !isolateLayout"
            class="node-panel__header"
        >
            <div class="node-panel__header-main">
                <div class="node-panel__header-text-row">
                    <div class="node-panel__header-text">
                        <div
                            v-if="isSectionNameEditing"
                            class="node-panel__section-name-editor"
                        >
                            <input
                                ref="sectionNameInputRef"
                                v-model="sectionNameDraft"
                                type="text"
                                placeholder="Section name"
                                @click.stop
                                @keydown.enter.prevent="saveSectionNameEdit"
                                @keydown.esc.prevent="cancelSectionNameEdit"
                            />
                            <button
                                type="button"
                                class="node-panel__section-name-btn"
                                @click.stop="saveSectionNameEdit"
                            >
                                Save
                            </button>
                            <button
                                type="button"
                                class="node-panel__section-name-btn node-panel__section-name-btn--secondary"
                                @click.stop="cancelSectionNameEdit"
                            >
                                Cancel
                            </button>
                        </div>
                        <strong v-else-if="sectionNameDisplay">
                            {{ sectionNameDisplay }}
                        </strong>
                        <strong v-else-if="isSectionNameEditable">
                            Unnamed section
                        </strong>
                        <strong v-else-if="slotDisplayName">
                            <span>{{ slotDisplayName }}</span>
                            <span class="node-panel__slot-suffix">(Slot)</span>
                        </strong>
                        <strong v-else>{{ node.component }}</strong>
                        <span
                            v-if="isGlobalAliasNode"
                            class="node-panel__global-badge"
                            title="This section uses a project-global component alias"
                        >
                            Global
                        </span>
                        <small class="component-internal-name">{{ node.component }}</small>
                    </div>
                    <button
                        v-if="isSectionNameEditable && !isSectionNameEditing"
                        type="button"
                        class="node-panel__section-name-trigger"
                        aria-label="Edit section name"
                        title="Edit section name"
                        @click.stop="handleHeaderTextClick"
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path
                                fill="currentColor"
                                d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25Zm2.92 2.33H5v-.92l9.06-9.06.92.92L5.92 19.58ZM20.7 7.04a1 1 0 0 0 0-1.41L18.37 3.3a1 1 0 0 0-1.41 0L15.13 5.13l3.75 3.75 1.82-1.84Z"
                            />
                        </svg>
                    </button>
                </div>
                <div v-if="!isolateLayout" class="node-panel__header-actions">
                    <button
                        type="button"
                        class="node-panel__toggle"
                        :data-state="
                            collapsedNodes[node.uid] ? 'collapsed' : 'expanded'
                        "
                        @click="toggleNode(node.uid)"
                    >
                        {{ collapsedNodes[node.uid] ? "Expand" : "Collapse" }}
                    </button>
                    <button
                        v-if="
                            showTranslateSection &&
                            isSectionNameEditable &&
                            onTranslateSection
                        "
                        class="node-panel__toggle node-panel__toggle--icon node-panel__toggle--translate"
                        type="button"
                        @click="triggerTranslateSection"
                        aria-label="Translate section"
                        title="Translate section"
                    >
                        <svg
                            class="node-panel__toggle-icon"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <path
                                fill="currentColor"
                                d="M12 3a1 1 0 0 1 1 1v1h3a1 1 0 1 1 0 2h-1.1a10.2 10.2 0 0 1-1.7 4.1c.9.8 1.9 1.4 2.9 1.8a1 1 0 1 1-.7 1.9c-1.2-.5-2.4-1.2-3.5-2.2c-1.1 1-2.3 1.7-3.5 2.2a1 1 0 1 1-.7-1.9c1.1-.4 2-1 2.9-1.8A10.2 10.2 0 0 1 9.1 7H8a1 1 0 1 1 0-2h3V4a1 1 0 0 1 1-1Zm-1 4a8.2 8.2 0 0 0 1 2.6A8.2 8.2 0 0 0 13 7h-2Zm6 10.6l.7 1.9a1 1 0 1 1-1.9.7l-.6-1.7h-4.4l-.6 1.7a1 1 0 0 1-1.9-.7l2.9-7.8a1 1 0 0 1 1.9 0l1.8 4.9ZM14.5 16l-1.5-4.1L11.5 16h3Z"
                            />
                        </svg>
                    </button>
                    <button
                        class="node-panel__toggle node-panel__toggle--icon"
                        type="button"
                        @click="triggerCreateGlobalAlias"
                        aria-label="Create global alias"
                        title="Create global alias"
                    >
                        <svg
                            class="node-panel__toggle-icon"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <path
                                fill="currentColor"
                                d="M7.75 3A2.75 2.75 0 0 0 5 5.75v12.5A2.75 2.75 0 0 0 7.75 21h8.5A2.75 2.75 0 0 0 19 18.25V8.83a2.75 2.75 0 0 0-.81-1.94l-2.08-2.08A2.75 2.75 0 0 0 14.17 4H7.75Zm6.5 1.75c.26 0 .52.1.71.29l2 2c.19.19.29.44.29.71V18.25c0 .55-.45 1-1 1h-8.5c-.55 0-1-.45-1-1V5.75c0-.55.45-1 1-1h6.5Zm-1.25 4a1 1 0 0 1 1 1v1h1a1 1 0 1 1 0 2h-1v1a1 1 0 1 1-2 0v-1h-1a1 1 0 1 1 0-2h1v-1a1 1 0 0 1 1-1Z"
                            />
                        </svg>
                    </button>
                    <button
                        class="node-panel__toggle node-panel__toggle--icon node-panel__toggle--clone"
                        type="button"
                        @click="onClone(node.uid)"
                        aria-label="Clone component"
                    >
                        <svg
                            class="node-panel__toggle-icon"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <path
                                fill="currentColor"
                                d="M8 4a2 2 0 0 0-2 2v8h2V6h8V4H8Zm4 4a2 2 0 0 0-2 2v8c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-8Zm0 2h8v8h-8v-8Z"
                            />
                        </svg>
                    </button>
                    <button
                        class="node-panel__toggle node-panel__toggle--icon node-panel__toggle--danger"
                        type="button"
                        @click="requestRemoveNode(node.uid)"
                        aria-label="Remove component"
                    >
                        <svg
                            class="node-panel__toggle-icon"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <path
                                fill="currentColor"
                                d="M9 3v2H5v2h1v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7h1V5h-4V3H9Zm-1 4h8v11H8V7Zm2 2v7h2V9h-2Zm4 0v7h2V9h-2Z"
                            />
                        </svg>
                    </button>
                </div>
            </div>
        </div>

        <div
            v-if="node.type === 'component'"
            class="node-panel__body"
            v-show="!collapsedNodes[node.uid]"
        >
            <NodePropsPanel
                :search-query="normalizedSearchQuery"
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
                :update-nested-array-item-field="updateNestedArrayItemField"
                :update-custom-nested-array-item-field="updateCustomNestedArrayItemField"
                :format-json-value="formatJsonValue"
                :on-translate-field="
                    showTranslateSection ? triggerTranslateField : undefined
                "
                :on-toggle-translate-selection="
                    showTranslateSection
                        ? triggerToggleTranslateFieldSelection
                        : undefined
                "
                :is-translate-selected="
                    showTranslateSection ? isTranslateFieldSelected : undefined
                "
            />

            <!-- New props are not enabled for the moment, keep it here for possible future use -->
            <!--
      <form class="node-panel__new-prop" @submit.prevent="handleAddCustomProp">
        <div>
          <input v-model="newPropKey" placeholder="Prop key (e.g. theme)" />
        </div>
        <div>
          <input v-model="newPropValue" placeholder="Value" />
        </div>
        <button type="submit">Add prop</button>
      </form>
-->

            <NodeMarginsPanel
                v-if="showSupplementalEditors"
                :margin-draft="marginDraft"
                :margin-options="marginOptions"
                :margin-sides="marginSides"
                :responsive-breakpoints="responsiveBreakpoints"
                v-model:showResponsiveMargins="showResponsiveMargins"
                :handle-margin-change="handleMarginChange"
                :reset-margins="resetMargins"
            />

            <NodeChildrenPanel
                v-if="showSupplementalEditors"
                :allow-children="Boolean(componentDef?.allowChildren)"
                :component-options="componentOptions"
                :node-uid="node.uid"
                :child-hint="componentDef?.childHint"
                :children="filteredChildren"
                :on-add-child-component="handleAddChildComponent"
                :on-add-child-text="onAddChildText"
            >
                <template #child="{ child }">
                    <NodeEditor
                        :node="child"
                        :registry="registry"
                        :component-options="componentOptions"
                        :global-alias-ids="globalAliasIds"
                        :show-translate-section="showTranslateSection"
                        :focus-request="focusRequest"
                        :search-query="normalizedSearchQuery"
                        :depth="isolateLayout ? 0 : depth + 1"
                        :isolate-layout="isolateLayout"
                        :focused-prop-display="focusedPropDisplay"
                        :on-update-prop="onUpdateProp"
                        :on-update-text="onUpdateText"
                        :on-add-child-component="onAddChildComponent"
                        :on-add-child-text="onAddChildText"
                        :on-remove="onRemove"
                        :on-clone="onClone"
                        :on-create-global-alias="onCreateGlobalAlias"
                        :on-toggle-expanded="onToggleExpanded"
                        :on-translate-field="
                            showTranslateSection ? onTranslateField : undefined
                        "
                        :on-translate-section="
                            showTranslateSection ? onTranslateSection : undefined
                        "
                        :on-toggle-translate-field-selection="
                            showTranslateSection
                                ? onToggleTranslateFieldSelection
                                : undefined
                        "
                        :is-translate-field-selected="
                            showTranslateSection
                                ? isTranslateFieldSelected
                                : undefined
                        "
                    />
                </template>
            </NodeChildrenPanel>
        </div>

        <div v-else class="node-panel__text">
            <label class="node-panel__field">
                <span>Text value</span>
                <div class="node-panel__input-wrap">
                    <div
                        v-if="shouldHighlightText(textDraft, 'text')"
                        class="node-panel__input-highlight node-panel__input-highlight--multiline"
                        v-html="getHighlightMarkup(textDraft)"
                        aria-hidden="true"
                    />
                    <textarea
                        v-model="textDraft"
                        rows="2"
                        @change="applyTextValue"
                        @blur="applyTextValue"
                        @scroll="syncHighlightScroll"
                    />
                </div>
            </label>
            <div class="node-panel__text-butons">
                <button
                    class="node-panel__toggle node-panel__toggle--icon node-panel__toggle--clone"
                    type="button"
                    @click="onClone(node.uid)"
                    aria-label="Clone text node"
                >
                    <svg
                        class="node-panel__toggle-icon"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path
                            fill="currentColor"
                            d="M8 4a2 2 0 0 0-2 2v8h2V6h8V4H8Zm4 4a2 2 0 0 0-2 2v8c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-8Zm0 2h8v8h-8v-8Z"
                        />
                    </svg>
                </button>
                <button
                    class="node-panel__toggle node-panel__toggle--icon node-panel__toggle--danger"
                    type="button"
                    @click="requestRemoveNode(node.uid)"
                    aria-label="Remove text node"
                >
                    <svg
                        class="node-panel__toggle-icon"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path
                            fill="currentColor"
                            d="M9 3v2H5v2h1v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7h1V5h-4V3H9Zm-1 4h8v11H8V7Zm2 2v7h2V9h-2Zm4 0v7h2V9h-2Z"
                        />
                    </svg>
                </button>
            </div>
        </div>
        <NodeInsertDialog
            v-if="insertDialog.key && insertDialog.type"
            :insert-dialog="insertDialog"
            :get-insert-positions="getInsertPositions"
            :handle-insert-at="handleInsertAt"
            :close-insert-dialog="closeInsertDialog"
        />
        <NodeInsertDialog
            v-if="nestedInsertDialog.visible && nestedInsertDialog.key && nestedInsertDialog.type"
            :insert-dialog="{
                key: nestedInsertDialog.key,
                type: nestedInsertDialog.type,
                schema: null,
            }"
            :get-insert-positions="getNestedInsertPositions"
            :handle-insert-at="handleNestedInsertAt"
            :close-insert-dialog="closeNestedInsertDialog"
        />
        <NodeReorderDialog
            v-if="reorderDialog.visible"
            :max-index="reorderDialog.maxIndex"
            v-model:newIndex="reorderDialog.newIndex"
            :confirm-reorder-dialog="confirmReorderDialog"
            :close-reorder-dialog="closeReorderDialog"
        />
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, toRaw, watch } from "vue";
import type {
    BuilderNodeChild,
    BuilderResponsiveMargin,
    ComponentArrayItemField,
    ComponentDefinition,
    ComponentPropSchema,
    ComponentRegistry,
} from "~/types/builder";
import {
    filterNodesBySearch,
    matchesSearchValue,
    normalizeSearchQuery,
} from "../../utils/builderSearch";
import NodeChildrenPanel from "./node-editor/NodeChildrenPanel.vue";
import NodeInsertDialog from "./node-editor/NodeInsertDialog.vue";
import NodeMarginsPanel from "./node-editor/NodeMarginsPanel.vue";
import NodePropsPanel from "./node-editor/NodePropsPanel.vue";
import NodeReorderDialog from "./node-editor/NodeReorderDialog.vue";
import { useNodeEditorSearchHighlight } from "./node-editor/composables/useNodeEditorSearchHighlight";
import { useNodeEditorFieldVisibility } from "./node-editor/composables/useNodeEditorFieldVisibility";
import { useNodeEditorDialogs } from "./node-editor/composables/useNodeEditorDialogs";

const isNestedArrayField = (
    field: ComponentArrayItemField,
): field is Extract<ComponentArrayItemField, { type: "jsonarray" }> =>
    field.type === "jsonarray";

const isStringArrayField = (
    field: ComponentArrayItemField,
): field is Extract<ComponentArrayItemField, { type: "stringarray" }> =>
    field.type === "stringarray";

const isObjectField = (
    field: ComponentArrayItemField,
): field is Extract<ComponentArrayItemField, { type: "jsonobject" }> =>
    field.type === "jsonobject";

const normalizedDefinitions = new WeakSet<ComponentDefinition>();

const normalizeSchemaUiWidget = (
    schema: ComponentPropSchema | ComponentArrayItemField,
) => {
    if (schema.ui?.widget === "textarea" && schema.type === "text") {
        schema.type = "textarea";
    }
    if ("fields" in schema && Array.isArray(schema.fields)) {
        schema.fields.forEach((field) => normalizeSchemaUiWidget(field));
    }
    if ("items" in schema && Array.isArray(schema.items)) {
        schema.items.forEach((item) => normalizeSchemaUiWidget(item));
    }
};

type PropInputType =
    | "text"
    | "textarea"
    | "boolean"
    | "select"
    | "json"
    | "jsonarray"
    | "jsonobject"
    | "stringarray"
    | "number";

const props = defineProps<{
    node: BuilderNodeChild;
    registry: ComponentRegistry;
    componentOptions: ComponentDefinition[];
    globalAliasIds?: string[];
    showTranslateSection?: boolean;
    searchQuery?: string;
    depth?: number;
    onUpdateProp: (uid: string, key: string, value: unknown) => void;
    onUpdateText: (uid: string, value: string) => void;
    onAddChildComponent: (parentUid: string, componentId: string) => void;
    onAddChildText: (parentUid: string) => void;
    onRemove: (uid: string) => void;
    onClone: (uid: string) => void;
    onCreateGlobalAlias?: (uid: string) => void;
    onToggleExpanded?: (uid: string, expanded: boolean) => void;
    onFocusNode?: (payload: {
        uid: string;
        mode: "flash" | "lock" | "clear";
    }) => void;
    onTranslateField?: (payload: {
        uid: string;
        propPath: Array<string | number>;
        label?: string;
    }) => void;
    onToggleTranslateFieldSelection?: (payload: {
        uid: string;
        propPath: Array<string | number>;
        label?: string;
        selected: boolean;
    }) => void;
    isTranslateFieldSelected?: (payload: {
        uid: string;
        propPath: Array<string | number>;
    }) => boolean;
    onTranslateSection?: (payload: {
        uid: string;
        label?: string;
    }) => void;
    sectionName?: string;
    onSaveSectionName?: (uid: string, value: string) => void;
    isolateLayout?: boolean;
    focusedPropDisplay?: "active" | "around" | "all";
    focusRequest?: {
        uidPath: string[];
        targetUid: string;
        propPath: Array<string | number>;
        token: number;
    } | null;
}>();

const depth = computed(() => props.depth ?? 0);
const isolateLayout = computed(() => props.isolateLayout === true);
const focusedPropDisplay = computed(() => props.focusedPropDisplay ?? "all");
const panelRef = ref<HTMLElement | null>(null);
const normalizedSearchQuery = computed(() =>
    normalizeSearchQuery(props.searchQuery),
);
let stickyMatchQuery = "";
let stickyObjectMatches = new WeakMap<object, boolean>();
let stickyPrimitiveMatches = new Map<string, boolean>();
let stickyArrayMatchesByScope = new Map<string, Set<number>>();

const ensureStickyMatchScope = () => {
    if (stickyMatchQuery === normalizedSearchQuery.value) {
        return;
    }
    stickyMatchQuery = normalizedSearchQuery.value;
    stickyObjectMatches = new WeakMap<object, boolean>();
    stickyPrimitiveMatches = new Map<string, boolean>();
    stickyArrayMatchesByScope = new Map<string, Set<number>>();
};

const stickyPrimitiveKey = (value: unknown): string => {
    if (value === null) {
        return "null";
    }
    if (value === undefined) {
        return "undefined";
    }
    return `${typeof value}:${String(value)}`;
};

const matchesSearch = (value: unknown) => {
    const query = normalizedSearchQuery.value;
    if (!query) {
        return true;
    }
    ensureStickyMatchScope();
    if (typeof value === "object" && value !== null) {
        const cached = stickyObjectMatches.get(value as object);
        if (cached !== undefined) {
            return cached;
        }
        const matched = matchesSearchValue(value, query);
        stickyObjectMatches.set(value as object, matched);
        return matched;
    }
    const key = stickyPrimitiveKey(value);
    const cached = stickyPrimitiveMatches.get(key);
    if (cached !== undefined) {
        return cached;
    }
    const matched = matchesSearchValue(value, query);
    stickyPrimitiveMatches.set(key, matched);
    return matched;
};
const {
    isSearchActive,
    shouldHighlightText,
    getHighlightMarkup,
    shouldHighlightSelect,
    syncHighlightScroll,
} = useNodeEditorSearchHighlight(normalizedSearchQuery, matchesSearch);

const componentDef = computed(() =>
    props.node.type === "component"
        ? props.registry.lookup[props.node.component]
        : undefined,
);
const isGlobalAliasNode = computed(() => {
    if (props.node.type !== "component") {
        return false;
    }
    const aliases = props.globalAliasIds ?? [];
    return aliases.includes(props.node.component);
});
const showTranslateSection = computed(
    () => props.showTranslateSection !== false,
);

const stickyChildMatchUids = ref<Set<string> | null>(null);

watch(
    () => normalizedSearchQuery.value,
    (query) => {
        if (!query || props.node.type !== "component") {
            stickyChildMatchUids.value = null;
            return;
        }
        stickyChildMatchUids.value = new Set(
            filterNodesBySearch(props.node.children || [], query).map(
                (child) => child.uid,
            ),
        );
    },
    { immediate: true },
);

const filteredChildren = computed(() => {
    if (props.node.type !== "component") {
        return [] as BuilderNodeChild[];
    }
    if (!normalizedSearchQuery.value) {
        return props.node.children || [];
    }
    const stickyMatches = stickyChildMatchUids.value;
    if (!stickyMatches) {
        return [];
    }
    return (props.node.children || []).filter((child) =>
        stickyMatches.has(child.uid),
    );
});

const notifyFocus = (mode: "flash" | "lock" | "clear" = "flash") => {
    if (props.onFocusNode) {
        props.onFocusNode({ uid: props.node.uid, mode });
    }
};

const requestRemoveNode = (uid: string) => {
    if (depth.value === 0 && typeof window !== "undefined") {
        const label = props.node.type === "component" ? "section" : "item";
        const confirmed = window.confirm(
            `Remove this ${label}? This action cannot be undone.`,
        );
        if (!confirmed) {
            return;
        }
    }

    props.onRemove(uid);
};

const triggerCreateGlobalAlias = () => {
    if (props.node.type !== "component") {
        return;
    }
    props.onCreateGlobalAlias?.(props.node.uid);
};

const toPropPathAttr = (segments: Array<string | number>): string =>
    segments.map((segment) => String(segment)).join(".");

const isDisabledElement = (element: Element): boolean => {
    if (element instanceof HTMLButtonElement) {
        return element.disabled;
    }
    if (element instanceof HTMLInputElement) {
        return element.disabled;
    }
    if (element instanceof HTMLTextAreaElement) {
        return element.disabled;
    }
    return element.getAttribute("aria-disabled") === "true";
};

/**
 * Waits until Vue DOM updates and browser layout have both settled enough for
 * scroll and focus calls to target visible fields.
 */
const waitForFocusLayout = () =>
    new Promise<void>((resolve) => {
        if (typeof window === "undefined") {
            resolve();
            return;
        }

        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => resolve());
        });
    });

const resolveFocusTarget = (field: HTMLElement): HTMLElement | null =>
    field.querySelector<HTMLElement>(
        'textarea, input:not([type="checkbox"]):not([type="hidden"]), [contenteditable="true"], .ProseMirror',
    );

/**
 * Rich text fields mount their editor surface after the prop wrapper exists.
 * Wait a few animation frames so focused preview edits land in the real input.
 */
const waitForFocusTarget = async (
    field: HTMLElement,
): Promise<HTMLElement | null> => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
        const target = resolveFocusTarget(field);
        if (target) {
            return target;
        }
        await nextTick();
        await waitForFocusLayout();
    }

    return null;
};

const findScrollableAncestor = (element: HTMLElement): HTMLElement | null => {
    let current = element.parentElement;
    while (current) {
        const style = window.getComputedStyle(current);
        const canScroll =
            /(auto|scroll)/.test(style.overflowY) &&
            current.scrollHeight > current.clientHeight;
        if (canScroll) {
            return current;
        }
        current = current.parentElement;
    }

    const scrollingElement = document.scrollingElement;
    return scrollingElement instanceof HTMLElement ? scrollingElement : null;
};

/**
 * Centers the target field in the editor container that can actually scroll.
 */
const scrollPropFieldIntoView = async (field: HTMLElement) => {
    field.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
    });
    await waitForFocusLayout();

    if (typeof window === "undefined") {
        return;
    }

    const scrollContainer = findScrollableAncestor(field);
    if (!scrollContainer) {
        return;
    }

    const fieldRect = field.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();
    const availableOffset = Math.max(
        16,
        (containerRect.height - fieldRect.height) / 2,
    );
    const nextScrollTop =
        scrollContainer.scrollTop +
        fieldRect.top -
        containerRect.top -
        availableOffset;

    scrollContainer.scrollTo({
        top: Math.max(0, nextScrollTop),
        behavior: "smooth",
    });
};

const toPathDepth = (path: string): number =>
    path
        .split(".")
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0).length;

const isPathPrefix = (targetPath: string, candidatePath: string): boolean =>
    targetPath === candidatePath || targetPath.startsWith(`${candidatePath}.`);

const expandCollapsedArrayPaths = async (
    panel: HTMLElement,
    propPath: Array<string | number>,
) => {
    const targetPath = toPropPathAttr(propPath);

    const candidates = Array.from(
        panel.querySelectorAll<HTMLElement>("[data-content-array-path]"),
    )
        .map((element) => ({
            element,
            path: element.getAttribute("data-content-array-path")?.trim() ?? "",
        }))
        .filter(({ path }) => path.length > 0 && isPathPrefix(targetPath, path))
        .sort((left, right) => toPathDepth(left.path) - toPathDepth(right.path));

    for (const candidate of candidates) {
        if (candidate.element.getAttribute("data-collapsed") !== "true") {
            continue;
        }

        const toggle = candidate.element.querySelector<HTMLElement>(
            ".node-panel__array-toggle",
        );
        if (!toggle || isDisabledElement(toggle)) {
            continue;
        }

        toggle.click();
        await nextTick();
    }
};

const focusPropInput = async (request: {
    uidPath: string[];
    targetUid: string;
    propPath: Array<string | number>;
}) => {
    if (!request.uidPath.includes(props.node.uid)) {
        return;
    }

    if (props.node.type === "component") {
        if (collapsedNodes[props.node.uid] ?? true) {
            collapsedNodes[props.node.uid] = false;
            props.onToggleExpanded?.(props.node.uid, true);
        }

        if (props.node.uid === request.targetUid) {
            const firstPathToken = request.propPath[0];
            if (
                typeof firstPathToken === "string" &&
                firstPathToken in collapsedArrays
            ) {
                collapsedArrays[firstPathToken] = false;
            }
        }
    }

    if (props.node.uid !== request.targetUid) {
        return;
    }

    await nextTick();
    await nextTick();

    const panel = panelRef.value;
    if (!panel) {
        return;
    }

    await expandCollapsedArrayPaths(panel, request.propPath);
    await nextTick();
    await waitForFocusLayout();

    const field = panel.querySelector<HTMLElement>(
        `[data-content-prop-path="${toPropPathAttr(request.propPath)}"]`,
    );
    if (!field) {
        return;
    }

    await scrollPropFieldIntoView(field);

    const targetSchema = resolvePropPathSchema(request.propPath);
    if (targetSchema && isImageFieldSchema(targetSchema)) {
        const imagePickerTrigger = field.querySelector<HTMLElement>(
            "[data-image-field-open-library]",
        );
        if (imagePickerTrigger && !isDisabledElement(imagePickerTrigger)) {
            imagePickerTrigger.click();
            return;
        }
    }

    const focusTarget = await waitForFocusTarget(field);

    if (!focusTarget) {
        return;
    }

    await scrollPropFieldIntoView(field);
    await waitForFocusLayout();
    focusTarget.focus({ preventScroll: true });
    if (
        focusTarget instanceof HTMLInputElement ||
        focusTarget instanceof HTMLTextAreaElement
    ) {
        focusTarget.select();
    }
};

const triggerTranslateSection = () => {
    if (!props.onTranslateSection || props.node.type !== "component") {
        return;
    }

    props.onTranslateSection({
        uid: props.node.uid,
        label:
            sectionNameDisplay.value ||
            (props.node.type === "component" ? props.node.component : "Section"),
    });
};

const triggerTranslateField = (payload: {
    propPath: Array<string | number>;
    label?: string;
}) => {
    if (!props.onTranslateField) {
        return;
    }

    props.onTranslateField({
        uid: props.node.uid,
        propPath: payload.propPath,
        label: payload.label,
    });
};

const triggerToggleTranslateFieldSelection = (payload: {
    propPath: Array<string | number>;
    label?: string;
    selected: boolean;
}) => {
    if (!props.onToggleTranslateFieldSelection) {
        return;
    }

    props.onToggleTranslateFieldSelection({
        uid: props.node.uid,
        propPath: payload.propPath,
        label: payload.label,
        selected: payload.selected,
    });
};

const isTranslateFieldSelected = (
    propPath: Array<string | number>,
): boolean =>
    props.isTranslateFieldSelected?.({
        uid: props.node.uid,
        propPath,
    }) ?? false;

const isSectionNameEditable = computed(
    () =>
        props.node.type === "component" &&
        depth.value === 0 &&
        typeof props.onSaveSectionName === "function",
);
const isSectionNameEditing = ref(false);
const sectionNameDraft = ref("");
const sectionNameInputRef = ref<HTMLInputElement | null>(null);
const sectionNameDisplay = computed(() => {
    if (!isSectionNameEditable.value) {
        return "";
    }
    const value = props.sectionName?.trim();
    return value || "";
});

const beginSectionNameEdit = () => {
    if (!isSectionNameEditable.value) {
        return;
    }
    sectionNameDraft.value = props.sectionName ?? "";
    isSectionNameEditing.value = true;
    nextTick(() => {
        sectionNameInputRef.value?.focus();
        sectionNameInputRef.value?.select();
    });
};

const saveSectionNameEdit = () => {
    if (!isSectionNameEditable.value || typeof props.onSaveSectionName !== "function") {
        return;
    }
    props.onSaveSectionName(props.node.uid, sectionNameDraft.value);
    isSectionNameEditing.value = false;
};

const cancelSectionNameEdit = () => {
    sectionNameDraft.value = props.sectionName ?? "";
    isSectionNameEditing.value = false;
};

const handleHeaderTextClick = () => {
    if (!isSectionNameEditable.value) {
        return;
    }
    beginSectionNameEdit();
};

watch(
    () => componentDef.value,
    (definition) => {
        if (!definition || normalizedDefinitions.has(definition)) {
            return;
        }
        definition.props?.forEach((prop) => normalizeSchemaUiWidget(prop));
        normalizedDefinitions.add(definition);
    },
    { immediate: true },
);

watch(
    () => props.sectionName,
    (value) => {
        if (isSectionNameEditing.value) {
            return;
        }
        sectionNameDraft.value = value ?? "";
    },
    { immediate: true },
);

watch(
    () => props.focusRequest?.token,
    () => {
        const request = props.focusRequest;
        if (!request || !request.uidPath.includes(props.node.uid)) {
            return;
        }
        void nextTick(() => {
            if (props.focusRequest?.token !== request.token) {
                return;
            }
            void focusPropInput(request);
        });
    },
    { immediate: true },
);

const propDraft = reactive<Record<string, any>>({});
const extraPropsDraft = reactive<Record<string, string>>({});
const jsonErrors = reactive<Record<string, string | null>>({});
const objectFieldErrors = reactive<
    Record<string, Record<string, string | null>>
>({});
const INTERNAL_NODE_PROP_KEYS = new Set<string>(["__builderSectionId"]);
const { filterVisibleFields } = useNodeEditorFieldVisibility({
    isSearchActive,
    matchesSearch,
    normalizedSearchQuery,
});
const baseVisibleProps = computed(() =>
    filterVisibleFields(componentDef.value?.props, propDraft).filter(
        (prop) => !INTERNAL_NODE_PROP_KEYS.has(prop.key),
    ),
);
const focusedPropKey = computed(() => {
    if (
        !isolateLayout.value ||
        !props.focusRequest ||
        props.focusRequest.targetUid !== props.node.uid
    ) {
        return null;
    }

    const firstPathToken = props.focusRequest.propPath[0];
    return typeof firstPathToken === "string" ? firstPathToken : null;
});

/**
 * Reads the optional editor grouping key from top-level prop metadata.
 * Focus groups let one visible preview target open related fields together.
 */
const resolveFocusGroup = (schema: ComponentPropSchema | undefined) => {
    const focusGroup = schema?.ui?.focusGroup;
    return typeof focusGroup === "string" && focusGroup.trim().length
        ? focusGroup.trim()
        : null;
};

const focusedPropGroup = computed(() => {
    const activeKey = focusedPropKey.value;
    if (!activeKey) {
        return null;
    }

    return resolveFocusGroup(
        baseVisibleProps.value.find((prop) => prop.key === activeKey),
    );
});

/**
 * Expands a grouped focused edit selection with one neighboring field on each
 * side for the optional "show fields around" view.
 */
const resolveAroundIndexes = (
    propsList: ComponentPropSchema[],
    activeIndexes: number[],
) => {
    const validIndexes = activeIndexes.filter((index) => index >= 0);
    if (!validIndexes.length) {
        return new Set<number>();
    }

    const firstIndex = Math.min(...validIndexes);
    const lastIndex = Math.max(...validIndexes);
    return new Set(
        [firstIndex - 1, ...validIndexes, lastIndex + 1].filter(
            (index) => index >= 0 && index < propsList.length,
        ),
    );
};

const visibleProps = computed(() => {
    const propsList = baseVisibleProps.value;
    const activeKey = focusedPropKey.value;
    if (
        !isolateLayout.value ||
        !activeKey ||
        focusedPropDisplay.value === "all"
    ) {
        return propsList;
    }

    const activeGroup = focusedPropGroup.value;
    if (activeGroup) {
        const groupIndexes = propsList
            .map((prop, index) =>
                resolveFocusGroup(prop) === activeGroup ? index : -1,
            )
            .filter((index) => index >= 0);

        if (focusedPropDisplay.value === "around") {
            const aroundIndexes = resolveAroundIndexes(propsList, groupIndexes);
            return propsList.filter((_prop, index) => aroundIndexes.has(index));
        }

        return propsList.filter(
            (prop) => resolveFocusGroup(prop) === activeGroup,
        );
    }

    const activeIndex = propsList.findIndex((prop) => prop.key === activeKey);
    if (activeIndex === -1) {
        return propsList;
    }

    if (focusedPropDisplay.value === "around") {
        return propsList.filter(
            (_prop, index) => Math.abs(index - activeIndex) <= 1,
        );
    }

    return propsList.filter((prop) => prop.key === activeKey);
});
const showSupplementalEditors = computed(
    () => !isolateLayout.value || focusedPropDisplay.value === "all",
);
const slotDisplayName = computed(() => {
    if (props.node.type !== "component") {
        return null;
    }
    if (componentDef.value?.label !== "Template (Slot)") {
        return null;
    }
    const rawValue =
        propDraft.slot ??
        (props.node.props ? props.node.props["slot"] : undefined);
    const slotName = typeof rawValue === "string" ? rawValue.trim() : "";
    return slotName || "Unnamed slot";
});

type IndexedEntry<T> = { value: T; index: number };

const toIndexedEntries = <T,>(values: T[]): Array<IndexedEntry<T>> =>
    values.map((value, index) => ({ value, index }));

const filterIndexedEntries = <T,>(
    values: T[],
    scopeKey: string,
): Array<IndexedEntry<T>> => {
    const entries = toIndexedEntries(values);
    if (!isSearchActive.value) {
        return entries;
    }
    ensureStickyMatchScope();
    let stickyIndexes = stickyArrayMatchesByScope.get(scopeKey);
    if (!stickyIndexes) {
        stickyIndexes = new Set<number>();
        for (const entry of entries) {
            if (matchesSearch(entry.value)) {
                stickyIndexes.add(entry.index);
            }
        }
        stickyArrayMatchesByScope.set(scopeKey, stickyIndexes);
    }
    return entries.filter((entry) => stickyIndexes.has(entry.index));
};

const getFilteredJsonArrayItems = (propKey: string) => {
    const items = Array.isArray(propDraft[propKey]) ? propDraft[propKey] : [];
    return filterIndexedEntries(items, `top-json:${propKey}`);
};

const getFilteredStringArrayItems = (propKey: string) => {
    const items = Array.isArray(propDraft[propKey]) ? propDraft[propKey] : [];
    return filterIndexedEntries(items, `top-string:${propKey}`);
};

const getFilteredArrayItemStringArrayItems = (
    propKey: string,
    parentIndex: number,
    field: Extract<ComponentArrayItemField, { type: "stringarray" }>,
) => {
    const items = getArrayItemStringArrayItems(propKey, parentIndex, field);
    return filterIndexedEntries(
        items,
        `item-string:${propKey}:${parentIndex}:${field.key}`,
    );
};
const textDraft = ref(props.node.type === "text" ? props.node.value : "");
// selectedChildComponent is no longer needed
const newPropKey = ref("");
const newPropValue = ref("");
const draggingArrayItem = ref<{
    propKey: string;
    index: number;
    type: "jsonarray" | "stringarray";
} | null>(null);
const dragOverArrayItem = ref<{ propKey: string; index: number } | null>(null);
const collapsedNodes = reactive<Record<string, boolean>>({});
const collapsedArrays = reactive<Record<string, boolean>>({});
const collapsedNestedArrays = reactive<Record<string, boolean>>({});

const nestedArrayKey = (
    propKey: string,
    parentIndex: number,
    fieldKey: string,
    childKey?: number | string,
) =>
    typeof childKey === "undefined"
        ? `${propKey}:${parentIndex}:${fieldKey}`
        : `${propKey}:${parentIndex}:${fieldKey}:${childKey}`;

const PROP_UPDATE_DEBOUNCE_MS = 500;
const propUpdateTimers = new Map<string, ReturnType<typeof setTimeout>>();

const timerKeyForProp = (key: string) => `${props.node.uid}:${key}`;

const schedulePropUpdate = (
    key: string,
    value: unknown,
    type: PropInputType,
) => {
    if (typeof window === "undefined") {
        applyProp(key, value, type);
        return;
    }

    const timerKey = timerKeyForProp(key);
    const existing = propUpdateTimers.get(timerKey);
    if (existing) {
        window.clearTimeout(existing);
    }

    const timer = window.setTimeout(() => {
        propUpdateTimers.delete(timerKey);
        applyProp(key, value, type);
    }, PROP_UPDATE_DEBOUNCE_MS);

    propUpdateTimers.set(timerKey, timer);
};

const flushPropUpdate = (key: string, value: unknown, type: PropInputType) => {
    if (typeof window !== "undefined") {
        const timerKey = timerKeyForProp(key);
        const existing = propUpdateTimers.get(timerKey);
        if (existing) {
            window.clearTimeout(existing);
            propUpdateTimers.delete(timerKey);
        }
    }

    applyProp(key, value, type);
};

const commitPropChange = (
    key: string,
    value: unknown,
    type: PropInputType,
    options: { debounce?: boolean } = {},
) => {
    if (options.debounce) {
        schedulePropUpdate(key, value, type);
    } else {
        flushPropUpdate(key, value, type);
    }
};

const applyArrayProp = (
    key: string,
    value: unknown,
    type: "jsonarray" | "stringarray",
) => {
    applyProp(key, value, type);
};

const marginOptions = [
    { label: "None", value: "0" },
    { label: "XS", value: "1" },
    { label: "SM", value: "2" },
    { label: "MD", value: "4" },
    { label: "LG", value: "6" },
    { label: "XL", value: "8" },
    { label: "2XL", value: "12" },
    { label: "4XL", value: "24" },
];

type MarginSide = "top" | "right" | "bottom" | "left";
type BreakpointKey = "base" | "sm" | "md" | "lg" | "xl";

const marginSides: Array<{ key: MarginSide; label: string; short: string }> = [
    { key: "top", label: "Top", short: "Top" },
    { key: "right", label: "Right", short: "Right" },
    { key: "bottom", label: "Bottom", short: "Bottom" },
    { key: "left", label: "Left", short: "Left" },
];

const responsiveBreakpoints = [
    { key: "sm", label: "Small ≥640px", short: "SM" },
    { key: "md", label: "Medium ≥768px", short: "MD" },
    { key: "lg", label: "Large ≥1024px", short: "LG" },
    { key: "xl", label: "XL ≥1280px", short: "XL" },
] as const;

const createMarginState = () => ({
    base: "0",
    sm: "0",
    md: "0",
    lg: "0",
    xl: "0",
});

const marginDraft = reactive<Record<MarginSide, Record<BreakpointKey, string>>>(
    ["top", "right", "bottom", "left"].reduce(
        (acc, side) => {
            acc[side as MarginSide] = createMarginState();
            return acc;
        },
        {} as Record<MarginSide, Record<BreakpointKey, string>>,
    ),
);

const showResponsiveMargins = ref(false);

const storageKeyForType = (
    key: string,
    type: PropInputType | ComponentPropSchema["type"],
) =>
    type === "stringarray" || type === "jsonarray" || type === "jsonobject"
        ? `:${key}`
        : key;

const definedPropKeys = computed(() => {
    const keys = new Set<string>();
    for (const prop of componentDef.value?.props || []) {
        keys.add(prop.key);
        keys.add(storageKeyForType(prop.key, prop.type));
    }
    return keys;
});

const extraPropEntries = computed(() => {
    if (props.node.type !== "component") {
        return [] as Array<{ key: string; value: unknown }>;
    }
    return Object.entries(props.node.props)
        .filter(
            ([key]) =>
                !definedPropKeys.value.has(key) &&
                !INTERNAL_NODE_PROP_KEYS.has(key) &&
                !key.endsWith("ImagekitTransforms"),
        )
        .map(([key, value]) => ({ key, value }));
});
const filteredExtraPropEntries = computed(() => {
    const entries = extraPropEntries.value;
    if (!isSearchActive.value) {
        return entries;
    }
    return entries.filter((entry) => {
        const draftValue =
            entry.key in extraPropsDraft
                ? extraPropsDraft[entry.key]
                : entry.value;
        return matchesSearch(draftValue);
    });
});

const getPropSchema = (key: string) =>
    componentDef.value?.props?.find((prop) => prop.key === key);

const findNestedFieldSchema = (
    schema: ComponentPropSchema | ComponentArrayItemField,
    key: string,
) => {
    if ("items" in schema && Array.isArray(schema.items)) {
        const nestedSchema = schema.items.find((item) => item.key === key);
        if (nestedSchema) {
            return nestedSchema;
        }
    }

    if ("fields" in schema && Array.isArray(schema.fields)) {
        return schema.fields.find((field) => field.key === key);
    }

    return undefined;
};

const resolvePropPathSchema = (propPath: Array<string | number>) => {
    const [rootKey, ...nestedPath] = propPath;
    if (typeof rootKey !== "string") {
        return undefined;
    }

    let schema: ComponentPropSchema | ComponentArrayItemField | undefined =
        getPropSchema(rootKey);
    for (const segment of nestedPath) {
        if (!schema) {
            return undefined;
        }

        if (typeof segment === "number") {
            continue;
        }

        schema = findNestedFieldSchema(schema, segment);
    }

    return schema;
};

const toCloneablePlainValue = (
    value: unknown,
    seen = new WeakMap<object, unknown>(),
): unknown => {
    if (value === null || value === undefined) {
        return value;
    }

    if (typeof value !== "object") {
        return value;
    }

    const raw = toRaw(value as object);
    if (seen.has(raw)) {
        return seen.get(raw);
    }

    if (Array.isArray(raw)) {
        const next: unknown[] = [];
        seen.set(raw, next);
        raw.forEach((entry) => {
            next.push(toCloneablePlainValue(entry, seen));
        });
        return next;
    }

    if (raw instanceof Date) {
        return new Date(raw.getTime());
    }

    const next: Record<string, unknown> = {};
    seen.set(raw, next);
    Object.entries(raw as Record<string, unknown>).forEach(([key, entry]) => {
        next[key] = toCloneablePlainValue(entry, seen);
    });
    return next;
};

const cloneValue = <T,>(value: T): T => {
    const raw = toCloneablePlainValue(value) as T;

    if (typeof structuredClone === "function") {
        try {
            return structuredClone(raw);
        } catch (error) {
            const isDataCloneError =
                typeof DOMException !== "undefined" &&
                error instanceof DOMException &&
                error.name === "DataCloneError";
            if (!isDataCloneError) {
                console.warn(
                    "structuredClone failed, falling back to JSON clone:",
                    error,
                );
            }
        }
    }

    try {
        return JSON.parse(JSON.stringify(raw)) as T;
    } catch (error) {
        if (raw && typeof raw === "object") {
            return { ...(raw as Record<string, unknown>) } as T;
        }
        return raw;
    }
};

const ensureArrayValue = (value: unknown): Array<Record<string, any>> => {
    const toObject = (entry: unknown) => {
        if (entry && typeof entry === "object") {
            return cloneValue(entry as Record<string, any>);
        }
        return {};
    };

    if (Array.isArray(value)) {
        return value.map((entry) => toObject(entry));
    }
    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return parsed.map((entry) => toObject(entry));
            }
        } catch (error) {
            console.warn("Failed to parse JSON array draft value:", error);
        }
    }
    return [];
};

const ensureObjectValue = (value: unknown): Record<string, any> => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
        return cloneValue(value as Record<string, any>);
    }
    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            if (
                parsed &&
                typeof parsed === "object" &&
                !Array.isArray(parsed)
            ) {
                return parsed as Record<string, any>;
            }
        } catch (error) {
            console.warn("Failed to parse JSON object draft value:", error);
        }
    }
    return {};
};

const isActiveMarginValue = (value?: string) =>
    Boolean(value && value !== "0" && value !== "none");

const applyMarginDraftToNode = () => {
    if (props.node.type !== "component") {
        return;
    }
    const next: BuilderNode["margins"] = {};
    for (const side of marginSides) {
        const state = marginDraft[side.key];
        const config: BuilderResponsiveMargin = {};
        if (isActiveMarginValue(state.base)) {
            config.base = state.base;
        }
        if (isActiveMarginValue(state.sm)) {
            config.sm = state.sm;
        }
        if (isActiveMarginValue(state.md)) {
            config.md = state.md;
        }
        if (isActiveMarginValue(state.lg)) {
            config.lg = state.lg;
        }
        if (isActiveMarginValue(state.xl)) {
            config.xl = state.xl;
        }
        if (Object.keys(config).length) {
            next[side.key] = config;
        }
    }

    props.node.margins = Object.keys(next).length ? next : undefined;
};

const setMarginDraftFromNode = () => {
    if (props.node.type !== "component") {
        for (const side of marginSides) {
            const state = marginDraft[side.key];
            state.base = "0";
            state.sm = "0";
            state.md = "0";
            state.lg = "0";
            state.xl = "0";
        }
        showResponsiveMargins.value = false;
        return;
    }

    let hasResponsive = false;
    for (const side of marginSides) {
        const state = marginDraft[side.key];
        const config = props.node.margins?.[side.key];
        state.base = config?.base ?? "0";
        state.sm = config?.sm ?? "0";
        state.md = config?.md ?? "0";
        state.lg = config?.lg ?? "0";
        state.xl = config?.xl ?? "0";
        if (
            isActiveMarginValue(state.sm) ||
            isActiveMarginValue(state.md) ||
            isActiveMarginValue(state.lg) ||
            isActiveMarginValue(state.xl)
        ) {
            hasResponsive = true;
        }
    }
    showResponsiveMargins.value = hasResponsive;
};

const handleMarginChange = (
    side: MarginSide,
    breakpoint: BreakpointKey,
    value: string,
) => {
    marginDraft[side][breakpoint] = value;
    if (breakpoint !== "base" && isActiveMarginValue(value)) {
        showResponsiveMargins.value = true;
    }
    applyMarginDraftToNode();
};

const resetMargins = () => {
    for (const side of marginSides) {
        const state = marginDraft[side.key];
        state.base = "0";
        state.sm = "0";
        state.md = "0";
        state.lg = "0";
        state.xl = "0";
    }
    showResponsiveMargins.value = false;
    applyMarginDraftToNode();
};

const ensureStringArray = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return value.map((entry) => String(entry ?? ""));
    }
    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return parsed.map((entry) => String(entry ?? ""));
            }
        } catch (error) {
            console.warn("Failed to parse string array draft value:", error);
        }
    }
    return [];
};

const IMAGEKIT_TRANSFORM_SUFFIX = "ImagekitTransforms";

const isImageKitTransformCompanionKey = (key: string) =>
    key.endsWith(IMAGEKIT_TRANSFORM_SUFFIX);

const imageKitTransformCompanionKey = (key: string) =>
    `${key}${IMAGEKIT_TRANSFORM_SUFFIX}`;

const isImageFieldSchema = (
    schema: ComponentPropSchema | ComponentArrayItemField,
) =>
    schema.ui?.component === "ContentImageField";

const imageKitTransformCompanionType = (schema: ComponentPropSchema) =>
    schema.type === "stringarray" ? "stringarray" : "text";

const normalizeImageKitTransformCompanionValue = (
    rawValue: unknown,
    type: "stringarray" | "text",
) => {
    if (type === "stringarray") {
        return ensureStringArray(rawValue);
    }
    if (typeof rawValue === "string") {
        return rawValue;
    }
    if (rawValue === null || rawValue === undefined) {
        return "";
    }
    return String(rawValue);
};

const ensureNestedArrayValue = (
    parent: Record<string, any>,
    field: Extract<ComponentArrayItemField, { type: "jsonarray" }>,
) => {
    const storageKey = `:${field.key}`;
    if (!(field.key in parent) && storageKey in parent) {
        const legacy = parent[storageKey];
        if (typeof legacy === "string") {
            try {
                const parsed = JSON.parse(legacy);
                if (Array.isArray(parsed)) {
                    parent[field.key] = parsed;
                }
            } catch (error) {
                console.warn(
                    "Failed to parse legacy nested array value:",
                    error,
                );
            }
        } else if (Array.isArray(legacy)) {
            parent[field.key] = legacy;
        }
        delete parent[storageKey];
    }

    const current = parent[field.key];
    if (Array.isArray(current)) {
        if (current.some((entry) => !entry || typeof entry !== "object")) {
            parent[field.key] = current.map((entry) =>
                entry && typeof entry === "object"
                    ? cloneValue(entry as Record<string, any>)
                    : createEmptyArrayItem(field.items || []),
            );
        }
        return parent[field.key] as Array<Record<string, any>>;
    }
    if (typeof current === "string") {
        try {
            const parsed = JSON.parse(current);
            if (Array.isArray(parsed)) {
                parent[field.key] = parsed.map((entry) =>
                    entry && typeof entry === "object"
                        ? cloneValue(entry as Record<string, any>)
                        : createEmptyArrayItem(field.items || []),
                );
                return parent[field.key] as Array<Record<string, any>>;
            }
        } catch (error) {
            console.warn(
                "Failed to parse nested JSON array draft value:",
                error,
            );
        }
    }
    parent[field.key] = [];
    delete parent[storageKey];
    return parent[field.key] as Array<Record<string, any>>;
};

const getNestedArrayItems = (
    propKey: string,
    parentIndex: number,
    field: Extract<ComponentArrayItemField, { type: "jsonarray" }>,
) => {
    if (!Array.isArray(propDraft[propKey])) {
        propDraft[propKey] = [];
    }
    if (!propDraft[propKey][parentIndex]) {
        propDraft[propKey][parentIndex] = {};
    }
    const parent = propDraft[propKey][parentIndex] as Record<string, any>;
    return ensureNestedArrayValue(parent, field);
};

const setNestedArrayItems = (
    propKey: string,
    parentIndex: number,
    field: Extract<ComponentArrayItemField, { type: "jsonarray" }>,
    items: Array<Record<string, any>>,
    options: { debounce?: boolean } = {},
) => {
    const current = ensureArrayValue(propDraft[propKey]);
    const next = current.map((entry) => cloneValue(entry));
    if (!next[parentIndex]) {
        next[parentIndex] = {};
    }
    delete next[parentIndex][`:${field.key}`];
    next[parentIndex][field.key] = items.map((item) => cloneValue(item));
    propDraft[propKey] = next;
    commitPropChange(propKey, next, "jsonarray", options);
};

const ensureNestedStringArrayValue = (
    parent: Record<string, any>,
    field: Extract<ComponentArrayItemField, { type: "stringarray" }>,
) => {
    const storageKey = `:${field.key}`;
    const hasStorage = storageKey in parent;

    if (!(field.key in parent)) {
        if (hasStorage) {
            const normalized = ensureStringArray(parent[storageKey]);
            parent[field.key] = normalized;
            delete parent[storageKey];
            return normalized;
        }
        parent[field.key] = [];
        return parent[field.key] as string[];
    }

    const current = parent[field.key];
    if (
        Array.isArray(current) &&
        current.every((entry) => typeof entry === "string")
    ) {
        if (hasStorage) {
            delete parent[storageKey];
        }
        return current as string[];
    }

    const normalized = ensureStringArray(current);
    parent[field.key] = normalized;
    if (hasStorage) {
        delete parent[storageKey];
    }
    return normalized;
};

const getArrayItemStringArrayItems = (
    propKey: string,
    parentIndex: number,
    field: Extract<ComponentArrayItemField, { type: "stringarray" }>,
) => {
    if (!Array.isArray(propDraft[propKey])) {
        propDraft[propKey] = [];
    }
    if (!propDraft[propKey][parentIndex]) {
        propDraft[propKey][parentIndex] = {};
    }
    const parent = propDraft[propKey][parentIndex] as Record<string, any>;
    return ensureNestedStringArrayValue(parent, field);
};

const setArrayItemStringArrayItems = (
    propKey: string,
    parentIndex: number,
    field: Extract<ComponentArrayItemField, { type: "stringarray" }>,
    items: string[],
    options: { debounce?: boolean } = {},
) => {
    const current = ensureArrayValue(propDraft[propKey]);
    const next = current.map((entry) => cloneValue(entry));
    if (!next[parentIndex]) {
        next[parentIndex] = {};
    }
    delete next[parentIndex][`:${field.key}`];
    next[parentIndex][field.key] = items.map((value) => String(value ?? ""));
    propDraft[propKey] = next;
    commitPropChange(propKey, next, "jsonarray", options);
};

const getArrayItemObjectValue = (
    propKey: string,
    parentIndex: number,
    field: Extract<ComponentArrayItemField, { type: "jsonobject" }>,
) => {
    if (!Array.isArray(propDraft[propKey])) {
        propDraft[propKey] = [];
    }
    if (!propDraft[propKey][parentIndex]) {
        propDraft[propKey][parentIndex] = {};
    }
    const parent = propDraft[propKey][parentIndex] as Record<string, any>;
    const current = parent[field.key];
    if (current && typeof current === "object" && !Array.isArray(current)) {
        return current as Record<string, any>;
    }
    const draft = buildObjectFieldDraft(field, current);
    parent[field.key] = draft;
    return draft;
};

const handleArrayItemStringArrayChange = (
    propKey: string,
    parentIndex: number,
    field: Extract<ComponentArrayItemField, { type: "stringarray" }>,
    itemIndex: number,
    rawValue: unknown,
    options: { debounce?: boolean } = {},
) => {
    const items = getArrayItemStringArrayItems(propKey, parentIndex, field);
    const next = items.map((entry, index) =>
        index === itemIndex ? String(rawValue ?? "") : entry,
    );
    setArrayItemStringArrayItems(propKey, parentIndex, field, next, options);
};

const addArrayItemStringArrayItem = (
    propKey: string,
    parentIndex: number,
    field: Extract<ComponentArrayItemField, { type: "stringarray" }>,
) => {
    const items = getArrayItemStringArrayItems(propKey, parentIndex, field);
    const next = [...items, ""];
    collapsedNestedArrays[nestedArrayKey(propKey, parentIndex, field.key)] =
        false;
    setArrayItemStringArrayItems(propKey, parentIndex, field, next);
};

const removeArrayItemStringArrayItem = (
    propKey: string,
    parentIndex: number,
    field: Extract<ComponentArrayItemField, { type: "stringarray" }>,
    itemIndex: number,
) => {
    const items = getArrayItemStringArrayItems(propKey, parentIndex, field);
    const next = items.filter((_, index) => index !== itemIndex);
    setArrayItemStringArrayItems(propKey, parentIndex, field, next);
};

const handleArrayItemObjectFieldChange = (
    propKey: string,
    parentIndex: number,
    field: Extract<ComponentArrayItemField, { type: "jsonobject" }>,
    nestedField: ComponentArrayItemField,
    rawValue: unknown,
    options: { debounce?: boolean } = {},
) => {
    const current = ensureArrayValue(propDraft[propKey]);
    const next = current.map((item) => ({ ...item }));
    if (!next[parentIndex]) {
        next[parentIndex] = createEmptyArrayItem(field ? [field] : []);
    }
    const normalized = normalizeObjectFieldValue(
        field,
        ensureObjectValue(next[parentIndex][field.key]),
    );
    normalized[nestedField.key] = normalizeArrayFieldValue(
        nestedField,
        rawValue,
    );
    next[parentIndex][field.key] = normalized;
    propDraft[propKey] = next;
    commitPropChange(propKey, next, "jsonarray", options);
};

const handleArrayItemObjectJsonChange = (
    propKey: string,
    parentIndex: number,
    field: Extract<ComponentArrayItemField, { type: "jsonobject" }>,
    rawValue: unknown,
) => {
    const current = ensureArrayValue(propDraft[propKey]);
    const next = current.map((item) => ({ ...item }));
    if (!next[parentIndex]) {
        next[parentIndex] = createEmptyArrayItem(field ? [field] : []);
    }
    const input =
        typeof rawValue === "string"
            ? rawValue
            : JSON.stringify(rawValue, null, 2);
    if (!input || !input.trim()) {
        next[parentIndex][field.key] = {};
        propDraft[propKey] = next;
        commitPropChange(propKey, next, "jsonarray");
        return;
    }
    try {
        const parsed = JSON.parse(input);
        next[parentIndex][field.key] = parsed;
        propDraft[propKey] = next;
        commitPropChange(propKey, next, "jsonarray");
    } catch (error) {
        console.warn("Failed to parse nested JSON object draft value:", error);
    }
};

const getNestedArrayItemObjectValue = (
    propKey: string,
    parentIndex: number,
    field: Extract<ComponentArrayItemField, { type: "jsonarray" }>,
    nestedIndex: number,
    nestedField: Extract<ComponentArrayItemField, { type: "jsonobject" }>,
) => {
    const items = getNestedArrayItems(propKey, parentIndex, field);
    if (!items[nestedIndex]) {
        items[nestedIndex] = createEmptyArrayItem(field.items || []);
    }
    const target = items[nestedIndex] as Record<string, any>;
    const current = target[nestedField.key];
    if (current && typeof current === "object" && !Array.isArray(current)) {
        return current as Record<string, any>;
    }
    const draft = buildObjectFieldDraft(nestedField, current);
    target[nestedField.key] = draft;
    return draft;
};

const handleNestedArrayItemObjectFieldChange = (
    propKey: string,
    parentIndex: number,
    field: Extract<ComponentArrayItemField, { type: "jsonarray" }>,
    nestedIndex: number,
    nestedField: Extract<ComponentArrayItemField, { type: "jsonobject" }>,
    nestedObjectField: ComponentArrayItemField,
    rawValue: unknown,
    options: { debounce?: boolean } = {},
) => {
    const items = getNestedArrayItems(propKey, parentIndex, field);
    const next = items.map((entry) => cloneValue(entry));
    if (!next[nestedIndex]) {
        next[nestedIndex] = createEmptyArrayItem(field.items || []);
    }
    const normalized = normalizeObjectFieldValue(
        nestedField,
        ensureObjectValue(next[nestedIndex][nestedField.key]),
    );
    normalized[nestedObjectField.key] = normalizeArrayFieldValue(
        nestedObjectField,
        rawValue,
    );
    next[nestedIndex][nestedField.key] = normalized;
    setNestedArrayItems(propKey, parentIndex, field, next, options);
};

const handleNestedArrayItemObjectJsonChange = (
    propKey: string,
    parentIndex: number,
    field: Extract<ComponentArrayItemField, { type: "jsonarray" }>,
    nestedIndex: number,
    nestedField: Extract<ComponentArrayItemField, { type: "jsonobject" }>,
    rawValue: unknown,
) => {
    const items = getNestedArrayItems(propKey, parentIndex, field);
    const next = items.map((entry) => cloneValue(entry));
    if (!next[nestedIndex]) {
        next[nestedIndex] = createEmptyArrayItem(field.items || []);
    }
    const input =
        typeof rawValue === "string"
            ? rawValue
            : JSON.stringify(rawValue, null, 2);
    if (!input || !input.trim()) {
        next[nestedIndex][nestedField.key] = {};
        setNestedArrayItems(propKey, parentIndex, field, next);
        return;
    }
    try {
        const parsed = JSON.parse(input);
        next[nestedIndex][nestedField.key] = parsed;
        setNestedArrayItems(propKey, parentIndex, field, next);
    } catch (error) {
        console.warn("Failed to parse nested object draft value:", error);
    }
};

const moveArrayItemStringArrayItem = (
    propKey: string,
    parentIndex: number,
    field: Extract<ComponentArrayItemField, { type: "stringarray" }>,
    fromIndex: number,
    toIndex: number,
) => {
    const items = getArrayItemStringArrayItems(propKey, parentIndex, field);
    if (
        fromIndex < 0 ||
        fromIndex >= items.length ||
        toIndex < 0 ||
        toIndex >= items.length
    ) {
        return;
    }
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setArrayItemStringArrayItems(propKey, parentIndex, field, next);
};

const getNestedArrayItemStringArrayItems = (
    propKey: string,
    parentIndex: number,
    field: Extract<ComponentArrayItemField, { type: "jsonarray" }>,
    nestedIndex: number,
    nestedField: Extract<ComponentArrayItemField, { type: "stringarray" }>,
) => {
    const nestedItems = getNestedArrayItems(propKey, parentIndex, field);
    if (!nestedItems[nestedIndex]) {
        nestedItems[nestedIndex] = createEmptyArrayItem(field.items || []);
    }
    const target = nestedItems[nestedIndex] as Record<string, any>;
    return ensureNestedStringArrayValue(target, nestedField);
};

const setNestedArrayItemStringArrayItems = (
    propKey: string,
    parentIndex: number,
    field: Extract<ComponentArrayItemField, { type: "jsonarray" }>,
    nestedIndex: number,
    nestedField: Extract<ComponentArrayItemField, { type: "stringarray" }>,
    items: string[],
    options: { debounce?: boolean } = {},
) => {
    const nestedItems = getNestedArrayItems(propKey, parentIndex, field);
    const nextItems = nestedItems.map((entry) => cloneValue(entry));
    if (!nextItems[nestedIndex]) {
        nextItems[nestedIndex] = createEmptyArrayItem(field.items || []);
    }
    delete nextItems[nestedIndex][`:${nestedField.key}`];
    nextItems[nestedIndex][nestedField.key] = items.map((value) =>
        String(value ?? ""),
    );
    setNestedArrayItems(propKey, parentIndex, field, nextItems, options);
};

const handleNestedArrayItemStringArrayChange = (
    propKey: string,
    parentIndex: number,
    field: Extract<ComponentArrayItemField, { type: "jsonarray" }>,
    nestedIndex: number,
    nestedField: Extract<ComponentArrayItemField, { type: "stringarray" }>,
    itemIndex: number,
    rawValue: unknown,
    options: { debounce?: boolean } = {},
) => {
    const items = getNestedArrayItemStringArrayItems(
        propKey,
        parentIndex,
        field,
        nestedIndex,
        nestedField,
    );
    const next = items.map((entry, index) =>
        index === itemIndex ? String(rawValue ?? "") : entry,
    );
    setNestedArrayItemStringArrayItems(
        propKey,
        parentIndex,
        field,
        nestedIndex,
        nestedField,
        next,
        options,
    );
};

const addNestedArrayItemStringArrayItem = (
    propKey: string,
    parentIndex: number,
    field: Extract<ComponentArrayItemField, { type: "jsonarray" }>,
    nestedIndex: number,
    nestedField: Extract<ComponentArrayItemField, { type: "stringarray" }>,
) => {
    const items = getNestedArrayItemStringArrayItems(
        propKey,
        parentIndex,
        field,
        nestedIndex,
        nestedField,
    );
    const next = [...items, ""];
    collapsedNestedArrays[
        nestedArrayKey(
            propKey,
            parentIndex,
            `${field.key}-${nestedField.key}`,
            nestedIndex,
        )
    ] = false;
    setNestedArrayItemStringArrayItems(
        propKey,
        parentIndex,
        field,
        nestedIndex,
        nestedField,
        next,
    );
};

const removeNestedArrayItemStringArrayItem = (
    propKey: string,
    parentIndex: number,
    field: Extract<ComponentArrayItemField, { type: "jsonarray" }>,
    nestedIndex: number,
    nestedField: Extract<ComponentArrayItemField, { type: "stringarray" }>,
    itemIndex: number,
) => {
    const items = getNestedArrayItemStringArrayItems(
        propKey,
        parentIndex,
        field,
        nestedIndex,
        nestedField,
    );
    const next = items.filter((_, index) => index !== itemIndex);
    setNestedArrayItemStringArrayItems(
        propKey,
        parentIndex,
        field,
        nestedIndex,
        nestedField,
        next,
    );
};

const moveNestedArrayItem = (
    propKey: string,
    parentIndex: number,
    field: Extract<ComponentArrayItemField, { type: "jsonarray" }>,
    fromIndex: number,
    toIndex: number,
) => {
    const items = getNestedArrayItems(propKey, parentIndex, field);
    if (
        fromIndex < 0 ||
        fromIndex >= items.length ||
        toIndex < 0 ||
        toIndex >= items.length
    ) {
        return;
    }
    const next = items.map((entry) => cloneValue(entry));
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setNestedArrayItems(propKey, parentIndex, field, next);
};

const moveNestedArrayItemStringArrayItem = (
    propKey: string,
    parentIndex: number,
    field: Extract<ComponentArrayItemField, { type: "jsonarray" }>,
    nestedIndex: number,
    nestedField: Extract<ComponentArrayItemField, { type: "stringarray" }>,
    fromIndex: number,
    toIndex: number,
) => {
    if (fromIndex === toIndex) {
        return;
    }
    const items = getNestedArrayItemStringArrayItems(
        propKey,
        parentIndex,
        field,
        nestedIndex,
        nestedField,
    );
    if (
        fromIndex < 0 ||
        fromIndex >= items.length ||
        toIndex < 0 ||
        toIndex >= items.length
    ) {
        return;
    }
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setNestedArrayItemStringArrayItems(
        propKey,
        parentIndex,
        field,
        nestedIndex,
        nestedField,
        next,
    );
};

const isNestedArrayCollapsed = (
    propKey: string,
    parentIndex: number,
    fieldKey: string,
    childKey?: number | string,
) => {
    const key = nestedArrayKey(propKey, parentIndex, fieldKey, childKey);
    if (!(key in collapsedNestedArrays)) {
        collapsedNestedArrays[key] = true;
    }
    return collapsedNestedArrays[key];
};

const toggleNestedArray = (
    propKey: string,
    parentIndex: number,
    fieldKey: string,
    childKey?: number | string,
) => {
    const key = nestedArrayKey(propKey, parentIndex, fieldKey, childKey);
    collapsedNestedArrays[key] = !(collapsedNestedArrays[key] ?? true);
};

const addNestedArrayItem = (
    propKey: string,
    parentIndex: number,
    field: Extract<ComponentArrayItemField, { type: "jsonarray" }>,
) => {
    const items = getNestedArrayItems(propKey, parentIndex, field);
    const next = [...items, createEmptyArrayItem(field.items || [])];
    collapsedNestedArrays[nestedArrayKey(propKey, parentIndex, field.key)] =
        false;
    setNestedArrayItems(propKey, parentIndex, field, next);
};

const removeNestedArrayItem = (
    propKey: string,
    parentIndex: number,
    field: Extract<ComponentArrayItemField, { type: "jsonarray" }>,
    index: number,
) => {
    const items = getNestedArrayItems(propKey, parentIndex, field);
    const next = items.filter((_, itemIndex) => itemIndex !== index);
    setNestedArrayItems(propKey, parentIndex, field, next);
};

const updateNestedArrayItemField = (
    propKey: string,
    parentIndex: number,
    field: Extract<ComponentArrayItemField, { type: "jsonarray" }>,
    index: number,
    nestedField: ComponentArrayItemField,
    rawValue: unknown,
    options: { debounce?: boolean } = {},
) => {
    const items = getNestedArrayItems(propKey, parentIndex, field);
    const next = items.map((entry, entryIndex) => {
        if (entryIndex !== index) {
            return entry;
        }
        const draft = cloneValue(entry);
        if (isNestedArrayField(nestedField)) {
            const ensured = ensureNestedArrayValue(draft, nestedField);
            let updated: Array<Record<string, any>>;
            if (Array.isArray(rawValue)) {
                updated = rawValue.map((value) =>
                    value && typeof value === "object" ? cloneValue(value) : {},
                );
            } else {
                try {
                    updated = ensureArrayValue(rawValue).map((value) =>
                        cloneValue(value),
                    );
                } catch (error) {
                    updated = ensured;
                }
            }
            draft[nestedField.key] = updated;
            delete draft[`:${nestedField.key}`];
            return draft;
        }
        if (isStringArrayField(nestedField)) {
            draft[nestedField.key] = ensureStringArray(rawValue);
            delete draft[`:${nestedField.key}`];
            return draft;
        }
        draft[nestedField.key] = normalizeArrayFieldValue(
            nestedField,
            rawValue,
        );
        delete draft[`:${nestedField.key}`];
        return draft;
    });
    setNestedArrayItems(propKey, parentIndex, field, next, options);
};

const updateCustomNestedArrayItemField = (
    propKey: string,
    parentIndex: number,
    field: Extract<ComponentArrayItemField, { type: "jsonarray" }>,
    index: number,
    nestedField: ComponentArrayItemField,
    value: unknown,
    options: { debounce?: boolean } = {},
) => {
    updateNestedArrayItemField(
        propKey,
        parentIndex,
        field,
        index,
        nestedField,
        value,
        options,
    );
};

const createEmptyArrayItem = (fields: ComponentArrayItemField[]) => {
    const item: Record<string, unknown> = {};
    for (const field of fields) {
        if (isNestedArrayField(field)) {
            item[field.key] = [];
            continue;
        }
        if (isStringArrayField(field)) {
            item[field.key] = [];
            continue;
        }
        if (isObjectField(field)) {
            item[field.key] = buildObjectFieldDraft(field, field.default ?? {});
            continue;
        }
        if (field.type === "boolean") {
            item[field.key] = false;
        } else if (field.type === "number") {
            item[field.key] = 0;
        } else {
            item[field.key] = "";
        }
    }
    return item;
};

const formatJsonValue = (value: unknown): string => {
    if (value === null || value === undefined) {
        return "";
    }

    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) {
            return "";
        }
        try {
            return JSON.stringify(JSON.parse(trimmed), null, 2);
        } catch (error) {
            return value;
        }
    }

    try {
        return JSON.stringify(value, null, 2);
    } catch (error) {
        return "";
    }
};

const hydrateDrafts = () => {
    for (const key of Object.keys(propDraft)) {
        delete propDraft[key];
    }
    for (const key of Object.keys(extraPropsDraft)) {
        delete extraPropsDraft[key];
    }
    for (const key of Object.keys(jsonErrors)) {
        delete jsonErrors[key];
    }
    for (const key of Object.keys(objectFieldErrors)) {
        delete objectFieldErrors[key];
    }

    if (props.node.type === "component") {
        if (!(props.node.uid in collapsedNodes)) {
            collapsedNodes[props.node.uid] =
                !props.focusRequest?.uidPath.includes(props.node.uid);
        }
        for (const key of definedPropKeys.value) {
            const schema = getPropSchema(key);
            const storageKey = schema
                ? storageKeyForType(schema.key, schema.type)
                : key;
            const rawValue =
                props.node.props?.[storageKey] ?? props.node.props?.[key];

            if (schema?.type === "boolean") {
                propDraft[key] = Boolean(rawValue);
            } else if (schema?.type === "json") {
                propDraft[key] = formatJsonValue(rawValue);
                jsonErrors[key] = null;
            } else if (schema?.type === "jsonarray") {
                propDraft[key] = ensureArrayValue(rawValue ?? []);
                if (!(key in collapsedArrays)) {
                    collapsedArrays[key] = true;
                }
            } else if (schema?.type === "jsonobject") {
                const storageKey = storageKeyForType(schema.key, schema.type);
                const value =
                    props.node.props?.[storageKey] ??
                    props.node.props?.[schema.key];
                if (!schema.fields || schema.fields.length === 0) {
                    propDraft[key] = formatJsonValue(value);
                    jsonErrors[key] = null;
                } else {
                    propDraft[key] = buildObjectDraft(schema, value);
                    objectFieldErrors[key] = {};
                }
            } else if (schema?.type === "stringarray") {
                propDraft[key] = ensureStringArray(rawValue ?? []);
                if (!(key in collapsedArrays)) {
                    collapsedArrays[key] = true;
                }
            } else {
                propDraft[key] = rawValue ?? "";
            }
        }

        for (const schema of componentDef.value?.props || []) {
            if (!isImageFieldSchema(schema)) {
                continue;
            }
            const companionKey = imageKitTransformCompanionKey(schema.key);
            const companionType = imageKitTransformCompanionType(schema);
            const companionStorageKey = storageKeyForType(
                companionKey,
                companionType,
            );
            const companionRawValue =
                props.node.props?.[companionStorageKey] ??
                props.node.props?.[companionKey];
            propDraft[companionKey] = normalizeImageKitTransformCompanionValue(
                companionRawValue,
                companionType,
            );
        }

        for (const entry of extraPropEntries.value) {
            extraPropsDraft[entry.key] = String(entry.value ?? "");
        }
        setMarginDraftFromNode();
    } else {
        textDraft.value = props.node.value;
        setMarginDraftFromNode();
    }
};

watch(
    () => props.node,
    () => {
        hydrateDrafts();
    },
    { immediate: true, deep: true },
);

const parseValueByType = (value: unknown, type: PropInputType) => {
    if (type === "boolean") {
        return Boolean(value);
    }
    if (type === "number") {
        const parsed = Number(value);
        return Number.isNaN(parsed) ? 0 : parsed;
    }
    return value;
};

const applyProp = (key: string, value: unknown, type: PropInputType) => {
    if (props.node.type !== "component") {
        return;
    }
    const storageKey = storageKeyForType(key, type);
    if (type === "json") {
        const input =
            typeof value === "string" ? value : JSON.stringify(value, null, 2);
        if (!input || !input.trim()) {
            jsonErrors[key] = null;
            props.onUpdateProp(props.node.uid, storageKey, []);
            return;
        }

        try {
            const parsed = JSON.parse(input);
            jsonErrors[key] = null;
            props.onUpdateProp(props.node.uid, storageKey, parsed);
        } catch (error) {
            jsonErrors[key] = "Invalid JSON";
        }
        return;
    }

    if (type === "jsonarray") {
        const normalized = ensureArrayValue(value);
        jsonErrors[key] = null;
        props.onUpdateProp(
            props.node.uid,
            storageKey,
            JSON.stringify(normalized),
        );
        if (storageKey !== key) {
            props.onUpdateProp(props.node.uid, key, undefined);
        }
        return;
    }

    if (type === "stringarray") {
        const normalized = ensureStringArray(value);
        jsonErrors[key] = null;
        props.onUpdateProp(
            props.node.uid,
            storageKey,
            JSON.stringify(normalized),
        );
        if (storageKey !== key) {
            props.onUpdateProp(props.node.uid, key, undefined);
        }
        return;
    }

    if (type === "jsonobject") {
        const schema = getPropSchema(key);
        const storageKey = storageKeyForType(key, type);

        if (!schema || !schema.fields || schema.fields.length === 0) {
            const input =
                typeof value === "string"
                    ? value
                    : JSON.stringify(value, null, 2);
            if (!input || !input.trim()) {
                jsonErrors[key] = null;
                props.onUpdateProp(
                    props.node.uid,
                    storageKey,
                    JSON.stringify({}),
                );
                if (storageKey !== key) {
                    props.onUpdateProp(props.node.uid, key, undefined);
                }
                return;
            }
            try {
                const parsed = JSON.parse(input);
                jsonErrors[key] = null;
                const payload = JSON.stringify(parsed);
                props.onUpdateProp(props.node.uid, storageKey, payload);
                if (storageKey !== key) {
                    props.onUpdateProp(props.node.uid, key, undefined);
                }
            } catch (error) {
                jsonErrors[key] = "Invalid JSON";
            }
            return;
        }

        const normalized = normalizeObjectDraftValue(schema, value);
        objectFieldErrors[key] = objectFieldErrors[key] || {};
        jsonErrors[key] = null;
        const payload = JSON.stringify(normalized);
        props.onUpdateProp(props.node.uid, storageKey, payload);
        if (storageKey !== key) {
            props.onUpdateProp(props.node.uid, key, undefined);
        }
        return;
    }

    const parsedValue = parseValueByType(value, type);
    jsonErrors[key] = null;
    props.onUpdateProp(props.node.uid, key, parsedValue);
};

onBeforeUnmount(() => {
    if (typeof window === "undefined") {
        return;
    }
    propUpdateTimers.forEach((timer) => window.clearTimeout(timer));
    propUpdateTimers.clear();
});

const handleCustomPropUpdate = (
    schema: ComponentPropSchema,
    value: unknown,
    options: { debounce?: boolean } = {},
) => {
    propDraft[schema.key] = value;
    commitPropChange(schema.key, value, schema.type, options);
};

function normalizeArrayFieldValue(
    field: ComponentArrayItemField,
    value: unknown,
) {
    if (isNestedArrayField(field)) {
        return ensureArrayValue(value);
    }
    if (isStringArrayField(field)) {
        return ensureStringArray(value);
    }
    if (isObjectField(field)) {
        return normalizeObjectFieldValue(field, value);
    }
    if (field.type === "boolean") {
        return Boolean(value);
    }
    if (field.type === "number") {
        const parsed = Number(value);
        return Number.isNaN(parsed) ? 0 : parsed;
    }
    return typeof value === "string" ? value : (value ?? "");
}

function buildObjectDraft(
    schema: ComponentPropSchema | undefined,
    value: unknown,
) {
    const fields = schema?.fields || [];
    const baseDefault =
        schema?.default &&
        typeof schema.default === "object" &&
        !Array.isArray(schema.default)
            ? ensureObjectValue(schema.default)
            : {};
    const source = { ...baseDefault, ...ensureObjectValue(value) };
    const draft: Record<string, any> = {};

    for (const field of fields) {
        const raw = source[field.key];
        if (raw === undefined) {
            if (field.default !== undefined) {
                draft[field.key] = cloneValue(field.default);
            } else if (field.type === "boolean") {
                draft[field.key] = false;
            } else if (
                field.type === "jsonarray" ||
                field.type === "stringarray"
            ) {
                draft[field.key] = [];
            } else if (field.type === "number") {
                draft[field.key] = 0;
            } else {
                draft[field.key] = "";
            }
        } else {
            draft[field.key] = normalizeArrayFieldValue(field, raw);
        }
    }

    for (const [key, raw] of Object.entries(source)) {
        if (!(key in draft)) {
            draft[key] = cloneValue(raw);
        }
    }

    return draft;
}

function normalizeObjectDraftValue(
    schema: ComponentPropSchema | undefined,
    value: unknown,
) {
    const fields = schema?.fields || [];
    const draft = ensureObjectValue(value);

    if (fields.length === 0) {
        return cloneValue(draft);
    }

    const result: Record<string, any> = {};
    const allowed = new Set(fields.map((field) => field.key));

    for (const field of fields) {
        const raw = draft[field.key];
        if (raw === undefined) {
            if (field.default !== undefined) {
                result[field.key] = cloneValue(field.default);
            } else if (field.type === "boolean") {
                result[field.key] = false;
            } else if (
                field.type === "jsonarray" ||
                field.type === "stringarray"
            ) {
                result[field.key] = [];
            } else if (field.type === "number") {
                result[field.key] = 0;
            } else {
                result[field.key] = "";
            }
        } else {
            result[field.key] = normalizeArrayFieldValue(field, raw);
        }
    }

    for (const [key, raw] of Object.entries(draft)) {
        if (!allowed.has(key)) {
            result[key] = cloneValue(raw);
        }
    }

    return result;
}

const schemaFromObjectField = (
    field: Extract<ComponentArrayItemField, { type: "jsonobject" }>,
): ComponentPropSchema => ({
    key: field.key,
    label: field.label,
    type: "jsonobject",
    fields: field.fields,
    default: field.default,
});

const buildObjectFieldDraft = (
    field: Extract<ComponentArrayItemField, { type: "jsonobject" }>,
    value: unknown,
) => buildObjectDraft(schemaFromObjectField(field), value);

const normalizeObjectFieldValue = (
    field: Extract<ComponentArrayItemField, { type: "jsonobject" }>,
    value: unknown,
) => normalizeObjectDraftValue(schemaFromObjectField(field), value);

const handleArrayItemFieldChange = (
    propKey: string,
    index: number,
    field: ComponentArrayItemField,
    rawValue: unknown,
    options: { debounce?: boolean } = {},
) => {
    if (isNestedArrayField(field)) {
        return;
    }
    if (!Array.isArray(propDraft[propKey])) {
        propDraft[propKey] = [];
    }
    const current = ensureArrayValue(propDraft[propKey]);
    const next = current.map((item) => ({ ...item }));
    if (!next[index]) {
        next[index] = createEmptyArrayItem(field ? [field] : []);
    }
    next[index][field.key] = normalizeArrayFieldValue(field, rawValue);
    propDraft[propKey] = next;
    commitPropChange(propKey, next, "jsonarray", options);
};

const handleObjectFieldChange = (
    propKey: string,
    field: ComponentArrayItemField,
    rawValue: unknown,
    options: { debounce?: boolean } = {},
) => {
    const schema = getPropSchema(propKey);
    if (!schema || schema.type !== "jsonobject") {
        return;
    }
    const draft = ensureObjectValue(propDraft[propKey]);
    draft[field.key] = normalizeArrayFieldValue(field, rawValue);
    propDraft[propKey] = draft;
    objectFieldErrors[propKey] = objectFieldErrors[propKey] || {};
    objectFieldErrors[propKey][field.key] = null;
    commitPropChange(propKey, draft, "jsonobject", options);
};

const handleCustomArrayFieldUpdate = (
    propKey: string,
    index: number,
    field: ComponentArrayItemField,
    value: unknown,
    options: { debounce?: boolean } = {},
) => {
    if (isNestedArrayField(field)) {
        return;
    }
    handleArrayItemFieldChange(propKey, index, field, value, options);
};

const removeArrayItem = (propKey: string, index: number) => {
    const current = ensureArrayValue(propDraft[propKey]);
    current.splice(index, 1);
    propDraft[propKey] = current;
    commitPropChange(propKey, current, "jsonarray");
};
const handleStringArrayChange = (
    propKey: string,
    index: number,
    rawValue: unknown,
    options: { debounce?: boolean } = {},
) => {
    const current = ensureStringArray(propDraft[propKey]);
    current[index] = String(rawValue ?? "");
    propDraft[propKey] = current;
    commitPropChange(propKey, current, "stringarray", options);
};

const removeStringArrayItem = (propKey: string, index: number) => {
    const current = ensureStringArray(propDraft[propKey]);
    current.splice(index, 1);
    propDraft[propKey] = current;
    commitPropChange(propKey, current, "stringarray");

    if (isImageKitTransformCompanionKey(propKey)) {
        return;
    }

    const companionKey = imageKitTransformCompanionKey(propKey);
    const companion = ensureStringArray(propDraft[companionKey]);
    if (!companion.length) {
        return;
    }
    companion.splice(index, 1);
    propDraft[companionKey] = companion;
    commitPropChange(companionKey, companion, "stringarray");
};

const handleArrayItemDragStart = (
    propKey: string,
    index: number,
    type: "jsonarray" | "stringarray",
    event: DragEvent,
) => {
    draggingArrayItem.value = { propKey, index, type };
    dragOverArrayItem.value = { propKey, index };
    event.dataTransfer?.setData("text/plain", `${propKey}:${index}`);
    event.dataTransfer?.setDragImage?.(
        (event.target as HTMLElement) || new Image(),
        0,
        0,
    );
};

const handleArrayItemDragEnter = (propKey: string, index: number) => {
    if (!draggingArrayItem.value) {
        return;
    }
    if (draggingArrayItem.value.propKey !== propKey) {
        return;
    }
    dragOverArrayItem.value = { propKey, index };
};

const handleArrayItemDragLeave = () => {
    dragOverArrayItem.value = null;
};

const reorderArrayItems = (
    propKey: string,
    fromIndex: number,
    toIndex: number,
    type: "jsonarray" | "stringarray",
) => {
    if (fromIndex === toIndex) {
        return;
    }

    if (type === "jsonarray") {
        const current = ensureArrayValue(propDraft[propKey]);
        if (!current[fromIndex]) {
            return;
        }
        const [moved] = current.splice(fromIndex, 1);
        current.splice(toIndex, 0, moved);
        propDraft[propKey] = current;
        commitPropChange(propKey, current, "jsonarray");
        return;
    }

    const current = ensureStringArray(propDraft[propKey]);
    if (fromIndex < 0 || fromIndex >= current.length) {
        return;
    }
    const [moved] = current.splice(fromIndex, 1);
    current.splice(toIndex, 0, moved);
    propDraft[propKey] = current;
    commitPropChange(propKey, current, "stringarray");

    if (isImageKitTransformCompanionKey(propKey)) {
        return;
    }

    const companionKey = imageKitTransformCompanionKey(propKey);
    const companion = ensureStringArray(propDraft[companionKey]);
    if (!companion.length) {
        return;
    }
    if (fromIndex < 0 || fromIndex >= companion.length) {
        return;
    }
    const [companionMoved] = companion.splice(fromIndex, 1);
    const targetIndex = Math.min(toIndex, companion.length);
    companion.splice(targetIndex, 0, companionMoved);
    propDraft[companionKey] = companion;
    commitPropChange(companionKey, companion, "stringarray");
};

const handleArrayItemDrop = (
    propKey: string,
    index: number,
    type: "jsonarray" | "stringarray",
) => {
    if (!draggingArrayItem.value) {
        return;
    }
    const {
        propKey: sourceKey,
        index: sourceIndex,
        type: sourceType,
    } = draggingArrayItem.value;
    if (sourceKey !== propKey || sourceType !== type) {
        draggingArrayItem.value = null;
        dragOverArrayItem.value = null;
        return;
    }

    reorderArrayItems(propKey, sourceIndex, index, type);
    draggingArrayItem.value = null;
    dragOverArrayItem.value = null;
};

const handleArrayItemDragEnd = () => {
    draggingArrayItem.value = null;
    dragOverArrayItem.value = null;
};

const toggleArray = (key: string) => {
    collapsedArrays[key] = !(collapsedArrays[key] ?? true);
};

const toggleNode = (uid: string) => {
    const current = collapsedNodes[uid] ?? true;
    const nextCollapsed = !current;
    collapsedNodes[uid] = nextCollapsed;
    if (typeof props.onToggleExpanded === "function") {
        props.onToggleExpanded(uid, !nextCollapsed);
    }
    notifyFocus(nextCollapsed ? "clear" : "lock");
};

const {
    insertDialog,
    nestedInsertDialog,
    insertFocusRequest,
    reorderDialog,
    openInsertDialog,
    closeInsertDialog,
    getInsertPositions,
    handleInsertAt,
    openArrayItemStringArrayInsertDialog,
    openNestedJsonArrayInsertDialog,
    openNestedStringArrayInsertDialog,
    closeNestedInsertDialog,
    getNestedInsertPositions,
    handleNestedInsertAt,
    clearInsertFocusRequest,
    openTopLevelArrayReorderDialog,
    openArrayItemStringArrayReorderDialog,
    openNestedJsonArrayReorderDialog,
    openNestedStringArrayReorderDialog,
    closeReorderDialog,
    confirmReorderDialog,
} = useNodeEditorDialogs({
    propDraft,
    collapsedArrays,
    ensureArrayValue,
    ensureStringArray,
    createEmptyArrayItem,
    applyArrayProp,
    getArrayItemStringArrayItems,
    getNestedArrayItems,
    getNestedArrayItemStringArrayItems,
    reorderArrayItems,
    moveArrayItemStringArrayItem,
    moveNestedArrayItem,
    moveNestedArrayItemStringArrayItem,
    addArrayItemStringArrayItem,
    addNestedArrayItem,
    addNestedArrayItemStringArrayItem,
});

watch(
    () => insertFocusRequest.value?.token,
    () => {
        const request = insertFocusRequest.value;
        if (!request) {
            return;
        }
        void focusPropInput({
            uidPath: [props.node.uid],
            targetUid: props.node.uid,
            propPath: request.path,
            token: request.token,
        }).finally(() => {
            clearInsertFocusRequest();
        });
    },
);

const handleAddChildComponent = (componentId: string) => {
    props.onAddChildComponent(props.node.uid, componentId);
};

const handleAddCustomProp = () => {
    if (!newPropKey.value.trim()) {
        return;
    }
    props.onUpdateProp(
        props.node.uid,
        newPropKey.value.trim(),
        newPropValue.value,
    );
    newPropKey.value = "";
    newPropValue.value = "";
};

const applyTextValue = () => {
    if (props.node.type !== "text") {
        return;
    }
    props.onUpdateText(props.node.uid, textDraft.value);
};
</script>

<style scoped>
.node-panel {
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 12px;
    margin-bottom: 12px;
    background: #fff;
    flex: 1;
}

.node-panel__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    /*margin-bottom: 12px;*/
}

.node-panel__header-main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
}

.node-panel__header-text {
    display: flex;
    flex-direction: column;
}

.node-panel--global-alias {
    border-color: #e2e8f0;
    background: #ffffff;
}

.node-panel--isolated {
    min-width: 0;
    max-width: 100%;
    overflow-x: clip;
    margin-bottom: 0;
    border-radius: 0;
}

.node-panel--isolated .node-panel__header-main {
    min-width: 0;
    align-items: flex-start;
    flex-wrap: wrap;
}

.node-panel--isolated .node-panel__header-text-row {
    min-width: 0;
    flex: 1 1 180px;
}

.node-panel--isolated .node-panel__header-actions {
    flex: 0 1 auto;
    justify-content: flex-end;
    flex-wrap: wrap;
}

.node-panel--isolated .node-panel__body,
.node-panel--isolated :deep(.node-panel__props),
.node-panel--isolated :deep(.node-panel__field),
.node-panel--isolated :deep(.node-panel__field-inline-control),
.node-panel--isolated :deep(.rich-text-field),
.node-panel--isolated :deep(.rich-text-field__surface),
.node-panel--isolated :deep(.ProseMirror) {
    min-width: 0;
    max-width: 100%;
}

.node-panel__header-text .component-internal-name {
  position: absolute;
    display: inline-flex;
    align-items: center;
    align-self: flex-start;
    margin-top: 4px;
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid #334155;
    background: #0f172a;
    color: #e2e8f0;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.01em;
    line-height: 1.35;
    opacity: 0;
    transform: translateY(-2px);
    pointer-events: none;
    transition:
        opacity 0.18s ease,
        transform 0.18s ease;
  bottom: 0;
  right: 0;
}

.node-panel:hover .component-internal-name,
.node-panel:focus-within .component-internal-name {
    opacity: 1;
    transform: translateY(0);
}

.node-panel__header-text-row {
    display: flex;
    align-items: center;
    gap: 8px;
}

.node-panel__global-badge {
    display: inline-flex;
    width: fit-content;
    align-items: center;
    gap: 5px;
    margin-top: 5px;
    padding: 3px 9px;
    border: 1px solid rgba(37, 99, 235, 0.3);
    border-radius: 999px;
    background: #dbeafe;
    color: #1d4ed8;
    font-size: 0.68rem;
    font-weight: 800;
    line-height: 1;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.node-panel__global-badge::before {
    content: "";
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
}

.node-panel__section-name-trigger {
    width: 26px;
    height: 26px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    background: #ffffff;
    color: #475569;
    opacity: 0;
    pointer-events: none;
    cursor: pointer;
    transition:
        opacity 0.15s ease,
        color 0.15s ease,
        border-color 0.15s ease;
}

.node-panel__header-main:hover .node-panel__section-name-trigger,
.node-panel__header-main:focus-within .node-panel__section-name-trigger {
    opacity: 1;
    pointer-events: auto;
}

.node-panel__section-name-trigger:hover,
.node-panel__section-name-trigger:focus-visible {
    color: #1d4ed8;
    border-color: #93c5fd;
}

.node-panel__section-name-trigger svg {
    width: 14px;
    height: 14px;
}

.node-panel__section-name-editor {
    display: flex;
    align-items: center;
    gap: 6px;
}

.node-panel__section-name-editor input {
    min-width: 220px;
    padding: 6px 8px;
    border-radius: 6px;
    border: 1px solid #cbd5e1;
    font: inherit;
}

.node-panel__section-name-btn {
    padding: 6px 10px;
    border-radius: 6px;
    border: 1px solid #1e293b;
    background: #1e293b;
    color: #ffffff;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
}

.node-panel__section-name-btn--secondary {
    border-color: #cbd5e1;
    background: #ffffff;
    color: #334155;
}

.node-panel__slot-suffix {
    margin-left: 6px;
    color: #94a3b8;
    font-weight: 500;
}

.node-panel__header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}

.node-panel__description {
    display: block;
    font-size: 0.875rem;
    color: #64748b;
}

.node-panel__body {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.node-panel :deep(.node-panel__props) {
    display: grid;
    gap: 2rem;
}

.node-panel :deep(.node-panel__field) {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.node-panel :deep(.node-panel__field-inline-control) {
    display: flex;
    align-items: flex-start;
    gap: 8px;
}

.node-panel :deep(.node-panel__field-inline-control > .node-panel__input-wrap) {
    flex: 1 1 auto;
    min-width: 0;
}

.node-panel :deep(.node-panel__field-inline-control > input),
.node-panel :deep(.node-panel__field-inline-control > textarea),
.node-panel :deep(.node-panel__field-inline-control > select),
.node-panel :deep(.node-panel__field-inline-control > [class*="content-"]) {
    flex: 1 1 auto;
    min-width: 0;
}

.node-panel :deep(.node-panel__translate-inline) {
    align-self: stretch;
    flex: 0 0 auto;
    min-height: 34px;
    padding: 0 10px;
    border: 1px solid #2563eb;
    border-radius: 6px;
    background: #eff6ff;
    color: #1d4ed8;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition:
        background 120ms ease,
        color 120ms ease,
        border-color 120ms ease,
        box-shadow 120ms ease;
}

.node-panel :deep(.node-panel__translate-inline-wrap) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.node-panel :deep(.node-panel__translate-select) {
    width: 14px;
    height: 14px;
    margin: 0;
    accent-color: #2563eb;
    cursor: pointer;
}

.node-panel :deep(.node-panel__translate-inline:hover),
.node-panel :deep(.node-panel__translate-inline:focus-visible) {
    background: #2563eb;
    color: #ffffff;
    border-color: #1d4ed8;
    box-shadow: 0 8px 20px rgba(37, 99, 235, 0.2);
}

.node-panel :deep(.node-panel__field--match) {
    outline: 2px solid rgba(250, 204, 21, 0.45);
    outline-offset: 2px;
    border-radius: 6px;
}

.node-panel :deep(.node-panel__field--localized) {
    border-radius: 6px;
    box-shadow:
        0 0 0 1px rgba(59, 130, 246, 0.45),
        0 0 12px rgba(56, 189, 248, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.node-panel :deep(.node-panel__field.is-row) {
    flex-direction: row;
    align-items: center;
}

:deep(.node-panel__input-wrap) {
    position: relative;
}

:deep(.node-panel__input-highlight) {
    position: absolute;
    inset: 0;
    padding: 6px 8px;
    pointer-events: none;
    color: transparent;
    overflow: hidden;
    border-radius: 4px;
    z-index: 2;
}

:deep(.node-panel__input-highlight--single) {
    white-space: pre;
}

:deep(.node-panel__input-highlight--multiline) {
    white-space: pre-wrap;
    word-break: break-word;
}

:deep(.node-panel__input-highlight mark) {
    background: rgba(250, 204, 21, 0.45);
    color: transparent;
}

:deep(.node-panel__input-wrap input),
:deep(.node-panel__input-wrap textarea) {
    position: relative;
    z-index: 1;
}

:deep(.node-panel__field input),
:deep(.node-panel__field textarea),
:deep(.node-panel__field select) {
    padding: 6px 8px;
    border-radius: 4px;
    border: 1px solid #cbd5f5;
    width: 100%;
}

.node-panel :deep(.node-panel__field--nested) {
    background: #f8fafc;
    padding: 8px;
    border: 1px dashed #cbd5f5;
}

.node-panel :deep(.node-panel__array) {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.node-panel :deep(.node-panel__object) {
    display: grid;
    gap: 12px;
}

.node-panel :deep(.node-panel__object--nested) {
    margin-left: 12px;
}

.node-panel :deep(.node-panel__object .node-panel__field--nested) {
    margin: 0;
}

.node-panel :deep(.node-panel__margins) {
    border-top: 1px dashed #e2e8f0;
    margin-top: 12px;
    padding-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.node-panel :deep(.node-panel__margins-header) {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.node-panel :deep(.node-panel__margins-title) {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: none;
    border: none;
    padding: 0;
    font-size: 0.9rem;
    font-weight: 600;
    color: #1e293b;
    cursor: pointer;
}

.node-panel :deep(.node-panel__margins-title.is-active) {
    color: #2563eb;
}

.node-panel :deep(.node-panel__margins-chevron) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    color: #64748b;
    transition: transform 140ms ease;
}

.node-panel :deep(.node-panel__margins-chevron[data-state="expanded"]) {
    transform: rotate(180deg);
    color: #2563eb;
}

.node-panel :deep(.node-panel__margins-actions) {
    display: flex;
    align-items: center;
    gap: 8px;
}

.node-panel :deep(.node-panel__margins-toggle) {
    font-size: 0.75rem;
    color: #334155;
    background: #f8fafc;
    border: 1px solid #cbd5f5;
    border-radius: 4px;
    padding: 4px 8px;
    cursor: pointer;
    transition:
        background 120ms ease,
        color 120ms ease,
        border-color 120ms ease;
}

.node-panel :deep(.node-panel__margins-toggle:hover),
.node-panel :deep(.node-panel__margins-toggle:focus-visible) {
    background: #e0f2fe;
    color: #1d4ed8;
    border-color: #93c5fd;
}

.node-panel :deep(.node-panel__margins-reset) {
    font-size: 0.75rem;
    color: #2563eb;
    background: transparent;
    border: none;
    cursor: pointer;
}

.node-panel :deep(.node-panel__margins-grid) {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
}

@media (min-width: 640px) {
    .node-panel :deep(.node-panel__margins-grid) {
        grid-template-columns: repeat(4, minmax(0, 1fr));
    }
}

.node-panel :deep(.node-panel__margins-grid--responsive) {
    gap: 8px;
}

.node-panel :deep(.node-panel__margin-field) {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.node-panel :deep(.node-panel__margin-field select) {
    border: 1px solid #cbd5f5;
    border-radius: 4px;
    padding: 6px 8px;
}

.node-panel :deep(.node-panel__array--nested) {
    gap: 8px;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px dashed #e2e8f0;
}

.node-panel :deep(.node-panel__array-header--nested) {
    align-items: center;
}

.node-panel :deep(.node-panel__array-header) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
}

.node-panel :deep(.node-panel__array-header-main) {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    flex: 1 1 auto;
}

.node-panel :deep(.node-panel__array-summary) {
    flex: 1 1 0;
    min-width: 0;
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow-wrap: anywhere;
    color: #475569;
    font-size: 0.82rem;
    line-height: 1.3;
}

.node-panel :deep(.node-panel__array-toggle) {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid #1e293b;
    border-radius: 6px;
    padding: 6px 14px;
    background: #ffffff;
    color: #1e293b;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition:
        border-color 140ms ease,
        background 140ms ease,
        color 140ms ease,
        box-shadow 140ms ease;
}

.node-panel :deep(.node-panel__array-toggle:hover),
.node-panel :deep(.node-panel__array-toggle:focus-visible) {
    background: #1e293b;
    color: #ffffff;
    box-shadow: 0 10px 25px rgba(30, 41, 59, 0.18);
    border-color: #1e293b;
}

.node-panel :deep(.node-panel__array-toggle::before) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1rem;
    content: "+";
    font-weight: 600;
    transition: transform 160ms ease;
}

.node-panel :deep(.node-panel__array-toggle[data-state="collapsed"]::before) {
    content: "+";
}

.node-panel :deep(.node-panel__array-toggle[data-state="expanded"]::before) {
    content: "–";
}

.node-panel :deep(.node-panel__array-toggle[data-state="expanded"]:hover::before),
.node-panel :deep(.node-panel__array-toggle[data-state="expanded"]:focus-visible::before) {
    transform: rotate(180deg);
}

.node-panel__toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid #1e293b;
    border-radius: 6px;
    padding: 6px 12px;
    background: #ffffff;
    color: #1e293b;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition:
        border-color 140ms ease,
        background 140ms ease,
        color 140ms ease,
        box-shadow 140ms ease;
}

.node-panel__toggle:hover,
.node-panel__toggle:focus-visible {
    background: #1e293b;
    color: #ffffff;
    box-shadow: 0 10px 20px rgba(30, 41, 59, 0.2);
    border-color: #1e293b;
}

.node-panel__toggle::before {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1rem;
    content: "•";
    font-weight: 600;
    transition: transform 160ms ease;
}

.node-panel__toggle[data-state="collapsed"]::before {
    content: "+";
}

.node-panel__toggle[data-state="expanded"]::before {
    content: "–";
}

.node-panel__toggle[data-state="expanded"]:hover::before,
.node-panel__toggle[data-state="expanded"]:focus-visible::before {
    transform: rotate(180deg);
}

.node-panel__toggle--icon {
    padding: 6px;
    min-width: 32px;
    height: 32px;
    justify-content: center;
    gap: 0;
}

.node-panel__toggle--icon::before {
    content: none;
    display: none;
}

.node-panel__toggle-icon {
    width: 16px;
    height: 16px;
    display: block;
    pointer-events: none;
}

.node-panel__toggle--clone {
    border-color: #0284c7;
    color: #0284c7;
}

.node-panel__toggle--clone:hover,
.node-panel__toggle--clone:focus-visible {
    background: #0284c7;
    color: #ffffff;
    border-color: #0284c7;
}

.node-panel__toggle--danger {
    border-color: #dc2626;
    color: #dc2626;
}

.node-panel__toggle--danger:hover,
.node-panel__toggle--danger:focus-visible {
    background: #dc2626;
    color: #ffffff;
    border-color: #dc2626;
}

.node-panel :deep(.node-panel__array-item) {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 10px;
    background: #f8fafc;
    display: flex;
    flex-direction: column;
    gap: 8px;
    cursor: move;
}

.node-panel :deep(.node-panel__array-item--nested) {
    cursor: default;
    margin-left: 12px;
    border-left: 3px solid #93c5fd;
    background: #ffffff;
}

.node-panel :deep(.node-panel__array-actions) {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
}

.node-panel :deep(.node-panel__array-reorder-link) {
    margin-left: 8px;
    background: none;
    border: none;
    color: #2563eb;
    cursor: pointer;
    transition: color 120ms ease;
}

.node-panel :deep(.node-panel__array-reorder-link:hover),
.node-panel :deep(.node-panel__array-reorder-link:focus-visible) {
    color: #1d4ed8;
}

.node-panel :deep(.node-panel__array-fields) {
    display: grid;
    gap: 8px;
}

.node-panel :deep(.node-panel__array-fields--nested) {
    gap: 6px;
}

.node-panel :deep(.node-panel__array-item--drag-over) {
    border-color: #2563eb;
    background: #eff6ff;
}

.node-panel :deep(.node-panel__checkbox) {
    position: relative;
    display: inline-flex;
    width: 1.5rem;
    height: 1.5rem;
    order: -1;
}

.node-panel :deep(.node-panel__checkbox-input) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
}

.node-panel :deep(.node-panel__checkbox-box) {
    width: 100%;
    height: 100%;
    border-radius: 0.4rem;
    border: 1.5px solid #94a3b8;
    background: #ffffff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: transparent;
    transition:
        background 140ms ease,
        border-color 140ms ease,
        color 140ms ease,
        box-shadow 140ms ease;
}

.node-panel :deep(.node-panel__checkbox svg) {
    width: 0.9rem;
    height: 0.9rem;
}

.node-panel :deep(.node-panel__checkbox:hover .node-panel__checkbox-box) {
    border-color: #2563eb;
}

.node-panel :deep(.node-panel__checkbox-input:focus-visible + .node-panel__checkbox-box) {
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.25);
    border-color: #2563eb;
}

.node-panel :deep(.node-panel__checkbox-input:checked + .node-panel__checkbox-box) {
    background: #2563eb;
    border-color: #2563eb;
    color: #ffffff;
}

.node-panel :deep(.node-panel__array-add) {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: 1px solid #0f766e;
    border-radius: 6px;
    padding: 6px 14px;
    background: #ffffff;
    color: #0f766e;
    font-weight: 600;
    cursor: pointer;
    transition:
        border-color 140ms ease,
        background 140ms ease,
        color 140ms ease,
        box-shadow 140ms ease;
}

.node-panel :deep(.node-panel__array-add:hover),
.node-panel :deep(.node-panel__array-add:focus-visible) {
    background: #0f766e;
    color: #ffffff;
    box-shadow: 0 10px 25px rgba(15, 118, 110, 0.25);
    border-color: #0f766e;
}

.node-panel :deep(.node-panel__array-add-icon) {
    display: inline-flex;
    width: 1.25rem;
    height: 1.25rem;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: rgba(15, 118, 110, 0.12);
    color: inherit;
    font-size: 1rem;
    transition:
        transform 160ms ease,
        background 140ms ease;
}

.node-panel :deep(.node-panel__array-add:hover .node-panel__array-add-icon),
.node-panel :deep(.node-panel__array-add:focus-visible .node-panel__array-add-icon) {
    transform: rotate(90deg);
    background: rgba(255, 255, 255, 0.25);
}

.node-panel :deep(.node-panel__array-remove) {
    align-self: flex-start;
    background: transparent;
    border: none;
    color: #ef4444;
    cursor: pointer;
}

.node-panel :deep(.node-panel__insert-dialog) {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.node-panel :deep(.node-panel__insert-backdrop) {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.45);
}

.node-panel :deep(.node-panel__insert-content) {
    position: relative;
    background: #ffffff;
    border-radius: 10px;
    padding: 24px;
    width: min(420px, 90vw);
    max-height: min(560px, 100vh);
    box-shadow: 0 40px 80px rgba(15, 23, 42, 0.25);
    animation: node-panel__insert-fade 160ms ease-out;
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow: hidden;
}

.node-panel :deep(.node-panel__insert-content--small) {
    width: min(360px, 90vw);
}

.node-panel :deep(.node-panel__insert-header) {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.node-panel :deep(.node-panel__insert-header h3) {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: #0f172a;
}

.node-panel :deep(.node-panel__insert-close) {
    background: transparent;
    border: none;
    font-size: 1.25rem;
    line-height: 1;
    cursor: pointer;
    color: #475569;
}

.node-panel :deep(.node-panel__insert-subtitle) {
    margin: 0;
    color: #64748b;
}

.node-panel :deep(.node-panel__insert-options) {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 0;
    margin: 0;
    flex: 1 1 auto;
    overflow-y: auto;
    scrollbar-width: thin;
}

.node-panel :deep(.node-panel__insert-options button) {
    width: 100%;
    text-align: left;
    border: 1px solid #cbd5f5;
    border-radius: 8px;
    padding: 12px;
    background: #f8fafc;
    cursor: pointer;
    transition:
        border-color 120ms ease,
        background 120ms ease;
}

.node-panel :deep(.node-panel__insert-options button strong) {
    display: block;
    margin-bottom: 4px;
    color: #1e293b;
}

.node-panel :deep(.node-panel__insert-options button span) {
    display: block;
    font-size: 0.85rem;
    color: #475569;
}

.node-panel :deep(.node-panel__insert-options button:hover) {
    border-color: #2563eb;
    background: #eff6ff;
}

.node-panel :deep(.node-panel__reorder-input label) {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 0.85rem;
    font-weight: 600;
    color: #0f172a;
}

.node-panel :deep(.node-panel__reorder-input input) {
    border: 1px solid #cbd5f5;
    border-radius: 6px;
    padding: 8px 10px;
    font-size: 0.95rem;
}

.node-panel :deep(.node-panel__insert-actions) {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
}

.node-panel :deep(.node-panel__insert-confirm),
.node-panel :deep(.node-panel__insert-cancel) {
    border-radius: 6px;
    border: 1px solid transparent;
    padding: 8px 16px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition:
        background 140ms ease,
        color 140ms ease,
        border-color 140ms ease;
}

.node-panel :deep(.node-panel__insert-confirm) {
    background: #2563eb;
    color: #ffffff;
}

.node-panel :deep(.node-panel__insert-confirm:hover),
.node-panel :deep(.node-panel__insert-confirm:focus-visible) {
    background: #1d4ed8;
}

.node-panel :deep(.node-panel__insert-cancel) {
    background: transparent;
    border-color: #cbd5f5;
    color: #0f172a;
}

.node-panel :deep(.node-panel__insert-cancel:hover),
.node-panel :deep(.node-panel__insert-cancel:focus-visible) {
    border-color: #94a3b8;
}

@keyframes node-panel__insert-fade {
    from {
        opacity: 0;
        transform: translateY(12px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.node-panel :deep(.node-panel__children) {
    margin-top: 8px;
}

.node-panel :deep(.node-panel__error) {
    color: #ef4444;
    font-size: 0.75rem;
}

.node-panel :deep(.node-panel__children-actions) {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
}

.node-panel :deep(.node-panel__hint) {
    font-size: 0.8rem;
    color: #64748b;
    margin: 8px 0;
}

.node-panel__new-prop {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.node-panel__new-prop input {
    padding: 6px 8px;
    border-radius: 4px;
    border: 1px solid #cbd5f5;
}

.node-panel :deep(.node-panel__margins-responsive) {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.node-panel :deep(.node-panel__margins-row) {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 12px;
    border: 1px dashed #e2e8f0;
    border-radius: 6px;
    background: #f8fafc;
}

.node-panel :deep(.node-panel__margin-breakpoint) {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #475569;
}

.node-panel__new-prop button {
    padding: 6px 12px;
}

.node-panel__text {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.node-panel__text-butons {
    display: flex;
    gap: 0.5rem;
}

.node-panel__text-butons button {
    flex: 1;
}
</style>
