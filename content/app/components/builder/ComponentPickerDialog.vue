<template>
    <div v-if="isOpen" class="component-picker-overlay" @click.self="close">
        <div class="component-picker-modal">
            <header class="component-picker-header">
                <h3>Select Component</h3>
                <div class="component-picker-search">
                     <svg
                        class="search-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        v-model="searchQuery"
                        type="text"
                        placeholder="Search components..."
                        ref="searchInput"
                        autofocus
                    />
                </div>
                <div class="component-picker-header-controls">
                    <button
                        v-if="categoryManagerAvailable"
                        type="button"
                        class="component-picker-manage-button"
                        :class="{ 'is-active': manageCategoriesOpen }"
                        @click="toggleManageCategories"
                    >
                        {{ manageCategoriesOpen ? "Picker" : "Categories" }}
                    </button>
                    <PreviewDeviceToggle v-model="previewDevice" />
                    <div class="component-picker-sort-control" aria-label="Sort components">
                        <div class="component-picker-view-toggle" aria-label="Sort components">
                            <RichTooltip
                                title="Sort by updated"
                                description="Show recently updated components first."
                            >
                                <template #default="{ describedby }">
                                    <button
                                        type="button"
                                        class="component-picker-view-toggle__button"
                                        aria-label="Sort by updated"
                                        :aria-describedby="describedby"
                                        :class="{ 'is-active': sortMode === 'updated' }"
                                        @click="sortMode = 'updated'"
                                    >
                                        <svg viewBox="0 0 24 24" aria-hidden="true">
                                            <path d="M12 7v5l3 2" />
                                            <path d="M21 12a9 9 0 1 1-3.6-7.2" />
                                            <path d="M21 4v6h-6" />
                                        </svg>
                                    </button>
                                </template>
                            </RichTooltip>
                            <RichTooltip
                                title="Sort by name"
                                description="Sort components alphabetically by label."
                            >
                                <template #default="{ describedby }">
                                    <button
                                        type="button"
                                        class="component-picker-view-toggle__button"
                                        aria-label="Sort by name"
                                        :aria-describedby="describedby"
                                        :class="{ 'is-active': sortMode === 'name' }"
                                        @click="sortMode = 'name'"
                                    >
                                        <svg viewBox="0 0 24 24" aria-hidden="true">
                                            <path d="M4 7h10" />
                                            <path d="M4 12h14" />
                                            <path d="M4 17h7" />
                                            <path d="M17 7l2-2l2 2" />
                                            <path d="M19 5v14" />
                                        </svg>
                                    </button>
                                </template>
                            </RichTooltip>
                        </div>
                    </div>
                    <label class="component-picker-density-control" for="component-picker-thumbnail-columns">
                        <span class="component-picker-density-control__meta">
                            <span class="component-picker-density-control__label">Thumbs</span>
                            <span class="component-picker-density-control__value">{{ thumbnailColumns }}</span>
                        </span>
                        <input
                            id="component-picker-thumbnail-columns"
                            v-model.number="thumbnailColumns"
                            type="range"
                            :min="THUMBNAIL_COLUMNS_MIN"
                            :max="THUMBNAIL_COLUMNS_MAX"
                            step="1"
                            @input="handleThumbnailColumnsInput"
                        />
                    </label>
                </div>
                <button class="close-button" @click="close">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </header>
            <div class="component-picker-tabs">
                <button
                    v-for="tab in categoryTabs"
                    :key="tab.id"
                    type="button"
                    class="component-picker-tab"
                    :class="{ 'is-active': selectedCategory === tab.id }"
                    @click="selectedCategory = tab.id"
                >
                    {{ tab.label }}
                </button>
            </div>
            <section v-if="manageCategoriesOpen" class="component-picker-manage">
                <aside class="component-picker-manage__sidebar">
                    <div class="component-picker-manage__head">
                        <h4>Categories</h4>
                        <span v-if="categorySaving" class="component-picker-manage__status">Saving...</span>
                    </div>
                    <form class="component-picker-manage__add" @submit.prevent="addDraftCategory">
                        <input
                            v-model="newCategoryLabel"
                            type="text"
                            placeholder="New category"
                        />
                        <button type="submit">Add</button>
                    </form>
                    <div class="component-picker-manage__categories">
                        <button
                            v-for="category in draftCategories"
                            :key="category.id"
                            type="button"
                            class="component-picker-manage__category"
                            :class="{ 'is-active': selectedManageCategoryId === category.id }"
                            @click="selectedManageCategoryId = category.id"
                        >
                            {{ category.label }}
                        </button>
                    </div>
                </aside>
                <div class="component-picker-manage__main">
                    <template v-if="selectedDraftCategory">
                        <div class="component-picker-manage__toolbar">
                            <label class="component-picker-manage__field">
                                <span>Label</span>
                                <input
                                    :value="selectedDraftCategory.label"
                                    type="text"
                                    @input="updateSelectedDraftCategoryLabel"
                                />
                            </label>
                            <label class="component-picker-manage__field">
                                <span>Search components</span>
                                <input
                                    v-model="manageSearchQuery"
                                    type="text"
                                    placeholder="Search by name or id"
                                />
                            </label>
                            <button
                                type="button"
                                class="component-picker-manage__delete"
                                @click="deleteSelectedDraftCategory"
                            >
                                Delete
                            </button>
                        </div>
                        <div class="component-picker-manage__assignments">
                            <label
                                v-for="component in manageableComponents"
                                :key="component.id"
                                class="component-picker-manage__assignment"
                            >
                                <input
                                    type="checkbox"
                                    :checked="isComponentAssignedToSelectedCategory(component.id)"
                                    @change="toggleComponentAssignment(component.id)"
                                />
                                <span>
                                    <strong>{{ component.label }}</strong>
                                    <small>{{ component.id }}</small>
                                </span>
                            </label>
                        </div>
                    </template>
                    <div v-else class="component-picker-manage__empty">
                        Add a category to start assigning components.
                    </div>
                    <p v-if="categoryError" class="component-picker-manage__error">
                        {{ categoryError }}
                    </p>
                    <div class="component-picker-manage__actions">
                        <button type="button" @click="cancelManageCategories">Cancel</button>
                        <button
                            type="button"
                            class="component-picker-manage__save"
                            :disabled="categorySaving"
                            @click="saveManageCategories"
                        >
                            Save
                        </button>
                    </div>
                </div>
            </section>
            <div
                v-else
                ref="componentGrid"
                class="component-picker-grid"
                :class="{ 'is-mobile-grid': previewDevice === 'mobile' }"
                :style="previewGridStyle"
            >
                <div
                    v-for="comp in filteredComponents"
                    :key="comp.id"
                    class="component-card"
                    role="button"
                    tabindex="0"

                >
                    <div class="component-card-preview" @click="select(comp.id)">
                        <div class="preview-pane">
                            <div
                                v-if="isPrimitiveComponent(comp)"
                                class="primitive-preview"
                                :class="`primitive-preview--${getPrimitivePreviewKind(comp)}`"
                            >
                                <template v-if="getPrimitivePreviewKind(comp) === 'paragraph'">
                                    <p class="primitive-preview__line"></p>
                                    <p class="primitive-preview__line primitive-preview__line--short"></p>
                                    <p class="primitive-preview__line"></p>
                                    <p class="primitive-preview__line primitive-preview__line--medium"></p>
                                </template>
                                <template v-else-if="getPrimitivePreviewKind(comp) === 'span'">
                                    <div class="primitive-preview__inline">
                                        <span class="primitive-preview__token">Inline</span>
                                        <span class="primitive-preview__token primitive-preview__token--muted">text</span>
                                        <span class="primitive-preview__token">sample</span>
                                    </div>
                                </template>
                                <template v-else-if="getPrimitivePreviewKind(comp) === 'strong'">
                                    <div class="primitive-preview__inline">
                                        <span class="primitive-preview__token primitive-preview__token--strong">Strong</span>
                                        <span class="primitive-preview__token primitive-preview__token--strong">emphasis</span>
                                    </div>
                                </template>
                                <template v-else>
                                    <div class="primitive-preview__slot">
                                        <span class="primitive-preview__slot-label">Slot</span>
                                        <span class="primitive-preview__slot-content">Drop child components here</span>
                                    </div>
                                </template>
                            </div>
                            <div
                                v-else
                                class="preview-scaler"
                                :class="{
                                    'is-desktop': previewDevice === 'desktop',
                                    'is-mobile': previewDevice === 'mobile'
                                }"
                            >
                                <LazyLoader min-height="100%" class="preview-lazy-loader">
                                    <PreviewFrame
                                        width="100%"
                                        height="100%"
                                    >
                                        <component
                                            :is="getPreviewComponentId(comp)"
                                            v-bind="getDefaultProps(comp)"
                                            class="component-picker-preview-fill-target"
                                        />
                                    </PreviewFrame>
                                </LazyLoader>
                            </div>
                            <div
                                v-if="!isPrimitiveComponent(comp)"
                                class="component-picker-preview-hit-layer"
                                role="button"
                                tabindex="-1"
                                :aria-label="`Select ${comp.label}`"
                                @click.stop="select(comp.id)"
                                @wheel="handlePreviewThumbnailWheel"
                            ></div>
                        </div>
                        <button class="expand-preview-btn" @click.stop="expandComponent(comp)" title="Expand Preview">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                            </svg>
                        </button>
                        <button
                            v-if="isGlobalComponentDefinition(comp)"
                            class="delete-global-component-btn"
                            type="button"
                            title="Delete global component"
                            @click.stop="deleteGlobalComponent(comp)"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M3 6h18" />
                                <path d="M8 6V4h8v2" />
                                <path d="M19 6l-1 14H6L5 6" />
                                <path d="M10 11v5" />
                                <path d="M14 11v5" />
                            </svg>
                        </button>
                    </div>
                    <div class="component-card-footer" @click="select(comp.id)">
                        <div class="component-info">
                            <span class="component-info__main">
                                <span class="component-name">{{ comp.label }}</span>
                            </span>
                            <span
                                v-if="formatComponentUpdatedAt(comp)"
                                class="component-card-meta component-updated-at"
                            >
                                Updated {{ formatComponentUpdatedAt(comp) }}
                            </span>
                            <span v-else class="component-card-meta component-id">{{ comp.id }}</span>
                        </div>
                        <p v-if="comp.description" class="component-description">
                            {{ comp.description }}
                        </p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Expanded Preview Modal -->
        <div v-if="expandedComp" class="expanded-preview-overlay" @click.self="closeExpanded">
            <div class="expanded-preview-modal">
                <header class="expanded-header">
                    <h3>Preview: {{ expandedComp.label }}</h3>
                    <div class="expanded-controls">
                        <PreviewDeviceToggle v-model="expandedDevice" />
                        <div class="action-buttons">
                            <button class="select-btn" @click="select(expandedComp.id)">
                                Select and Close
                            </button>
                            <button class="close-expanded-btn" @click="closeExpanded">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </header>
                <div class="expanded-content" :class="expandedDevice">
                    <div class="expanded-frame-wrapper" :style="{ width: expandedDevice === 'mobile' ? '375px' : '100%' }">
                         <PreviewFrame
                            :width="expandedDevice === 'mobile' ? 375 : '100%'"
                            :height="'100%'"
                            class="full-size-frame"
                        >
                            <component
                                :is="getPreviewComponentId(expandedComp)"
                                v-bind="getDefaultProps(expandedComp)"
                                class="component-picker-preview-fill-target"
                            />
                        </PreviewFrame>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted, onBeforeUnmount } from "vue";
import type { CSSProperties } from "vue";
import type { ComponentDefinition, BuilderValue } from "~/types/builder";
import PreviewFrame from "./PreviewFrame.vue";
import PreviewDeviceToggle from "./PreviewDeviceToggle.vue";
import LazyLoader from "./LazyLoader.vue";
import RichTooltip from "../ui/RichTooltip.vue";
import { declaredPreviewDefaults } from "#content/app/utils/component-preview";
import { useComponentPickerCategories } from "#content/app/composables/useComponentPickerCategories";
import {
    buildComponentPickerCategoryTabs,
    filterComponentPickerDefinitions,
    getEffectiveComponentPickerCategoryIds,
    normalizeComponentPickerCategorySettings,
    slugifyComponentPickerCategory,
    type ComponentPickerCategory,
} from "#content/app/utils/component-picker-categories";

const props = defineProps<{
    isOpen: boolean;
    componentOptions: ComponentDefinition[];
}>();

const emit = defineEmits<{
    (e: "close"): void;
    (e: "select", id: string): void;
    (e: "delete-global-component", id: string): void;
}>();

const searchQuery = ref("");
const searchInput = ref<HTMLInputElement | null>(null);
const componentGrid = ref<HTMLElement | null>(null);
const componentGridInlineSize = ref(0);
const selectedCategory = ref("default");
type ComponentPickerSortMode = "updated" | "name";
const sortMode = ref<ComponentPickerSortMode>("updated");
const manageCategoriesOpen = ref(false);
const draftCategories = ref<ComponentPickerCategory[]>([]);
const draftAssignments = ref<Record<string, string[]>>({});
const selectedManageCategoryId = ref("");
const newCategoryLabel = ref("");
const manageSearchQuery = ref("");
const previewDevice = ref<'desktop' | 'mobile'>('desktop');
const THUMBNAIL_COLUMNS_MIN = 2;
const THUMBNAIL_COLUMNS_MAX = 10;
const THUMBNAIL_COLUMNS_STORAGE_KEY = "content-builder:component-picker:thumbnail-columns";
const thumbnailColumns = ref(2);
const DESKTOP_PREVIEW_SCALE_MIN = 0.18;
const DESKTOP_PREVIEW_SCALE_MAX = 0.55;
const MOBILE_PREVIEW_SCALE_MIN = 0.24;
const MOBILE_PREVIEW_SCALE_MAX = 0.42;
const DESKTOP_PREVIEW_MIN_VIEWPORT_WIDTH = 1280;
const MOBILE_PREVIEW_MIN_VIEWPORT_WIDTH = 360;
const MOBILE_PREVIEW_MAX_VIEWPORT_WIDTH = 480;
// Global multiplier for thumbnail preview zoom density.
// Increase for larger previews, decrease for smaller.
const PREVIEW_SCALE_ADJUSTER = 1.2;
const COMPONENT_PICKER_GRID_GAP = 20;
const COMPONENT_PICKER_GRID_INLINE_PADDING = 48;
const COMPONENT_PICKER_CARD_PREVIEW_INLINE_PADDING = 24;

const expandedComp = ref<ComponentDefinition | null>(null);
const expandedDevice = ref<'desktop' | 'mobile'>('desktop');

const {
    settings: categorySettings,
    saving: categorySaving,
    error: categoryError,
    available: categoryManagerAvailable,
    fetchAdmin: fetchCategorySettings,
    saveAdmin: saveCategorySettings,
} = useComponentPickerCategories();

const expandComponent = (comp: ComponentDefinition) => {
    expandedComp.value = comp;
    expandedDevice.value = 'desktop';
};

const closeExpanded = () => {
    expandedComp.value = null;
};

const isGlobalComponentDefinition = (definition: ComponentDefinition): boolean =>
    definition.category === "global" ||
    typeof definition.previewComponentId === "string";

const deleteGlobalComponent = (definition: ComponentDefinition) => {
    const confirmed =
        !import.meta.client ||
        window.confirm(`Delete global component "${definition.id}"?`);
    if (!confirmed) {
        return;
    }
    emit("delete-global-component", definition.id);
};

const PRIMITIVE_COMPONENT_IDS = new Set(["p", "span", "strong", "template"]);
const PRIMITIVE_COMPONENT_LABELS = new Set([
    "paragraph",
    "span",
    "strong text",
    "template (slot)",
    "template",
]);

const isPrimitiveComponent = (definition: ComponentDefinition): boolean => {
    const id = definition.id.trim().toLowerCase();
    const label = definition.label.trim().toLowerCase();
    return PRIMITIVE_COMPONENT_IDS.has(id) || PRIMITIVE_COMPONENT_LABELS.has(label);
};

const compareComponentNames = (
    left: ComponentDefinition,
    right: ComponentDefinition,
): number => {
    const labelComparison = left.label.localeCompare(right.label);
    if (labelComparison !== 0) {
        return labelComparison;
    }
    return left.id.localeCompare(right.id);
};

const getComponentUpdatedTime = (definition: ComponentDefinition): number | null => {
    if (typeof definition.lastUpdatedAt !== "string") {
        return null;
    }
    const timestamp = Date.parse(definition.lastUpdatedAt);
    return Number.isFinite(timestamp) ? timestamp : null;
};

const sortComponentDefinitions = (
    definitions: ComponentDefinition[],
): ComponentDefinition[] => {
    const sorted = [...definitions];
    if (sortMode.value === "name") {
        return sorted.sort(compareComponentNames);
    }

    return sorted.sort((left, right) => {
        const leftUpdated = getComponentUpdatedTime(left);
        const rightUpdated = getComponentUpdatedTime(right);

        if (leftUpdated !== null && rightUpdated !== null && leftUpdated !== rightUpdated) {
            return rightUpdated - leftUpdated;
        }
        if (leftUpdated !== null && rightUpdated === null) {
            return -1;
        }
        if (leftUpdated === null && rightUpdated !== null) {
            return 1;
        }
        return compareComponentNames(left, right);
    });
};

const formatComponentUpdatedAt = (definition: ComponentDefinition): string => {
    const timestamp = getComponentUpdatedTime(definition);
    if (timestamp === null) {
        return "";
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(timestamp));
};

const getPrimitivePreviewKind = (
    definition: ComponentDefinition,
): "paragraph" | "span" | "strong" | "template" => {
    const id = definition.id.trim().toLowerCase();
    const label = definition.label.trim().toLowerCase();

    if (id === "p" || label === "paragraph") {
        return "paragraph";
    }
    if (id === "span" || label === "span") {
        return "span";
    }
    if (id === "strong" || label === "strong text") {
        return "strong";
    }
    return "template";
};

const categoryTabs = computed(() => {
    return buildComponentPickerCategoryTabs(
        props.componentOptions,
        categorySettings.value,
    );
});

const filteredComponents = computed(() => {
    const selected = selectedCategory.value;
    const byCategory = filterComponentPickerDefinitions(
        props.componentOptions,
        categorySettings.value,
        selected,
    );

    if (!searchQuery.value.trim()) return sortComponentDefinitions(byCategory);
    const q = searchQuery.value.toLowerCase();
    return sortComponentDefinitions(
        byCategory.filter(
            (c) =>
                c.label.toLowerCase().includes(q) ||
                c.id.toLowerCase().includes(q) ||
                getEffectiveComponentPickerCategoryIds(c, categorySettings.value).some(
                    (categoryId) => categoryId.includes(q),
                )
        ),
    );
});

const selectedDraftCategory = computed(() =>
    draftCategories.value.find(
        (category) => category.id === selectedManageCategoryId.value,
    ) ?? null,
);

const manageableComponents = computed(() => {
    const query = manageSearchQuery.value.trim().toLowerCase();
    const definitions = [...props.componentOptions].sort((left, right) =>
        left.label.localeCompare(right.label),
    );
    if (!query) {
        return definitions;
    }
    return definitions.filter(
        (definition) =>
            definition.label.toLowerCase().includes(query) ||
            definition.id.toLowerCase().includes(query),
    );
});

const cloneCategorySettingsToDraft = () => {
    const normalized = normalizeComponentPickerCategorySettings(categorySettings.value);
    draftCategories.value = normalized.categories.map((category) => ({ ...category }));
    draftAssignments.value = Object.fromEntries(
        Object.entries(normalized.assignments).map(([componentId, categoryIds]) => [
            componentId,
            [...categoryIds],
        ]),
    );
    selectedManageCategoryId.value = draftCategories.value[0]?.id ?? "";
    newCategoryLabel.value = "";
    manageSearchQuery.value = "";
};

const toggleManageCategories = () => {
    if (manageCategoriesOpen.value) {
        cancelManageCategories();
        return;
    }
    cloneCategorySettingsToDraft();
    manageCategoriesOpen.value = true;
};

const cancelManageCategories = () => {
    manageCategoriesOpen.value = false;
    cloneCategorySettingsToDraft();
};

const addDraftCategory = () => {
    const label = newCategoryLabel.value.trim();
    const id = slugifyComponentPickerCategory(label);
    if (!id || draftCategories.value.some((category) => category.id === id)) {
        return;
    }
    draftCategories.value = [
        ...draftCategories.value,
        {
            id,
            label,
            order: draftCategories.value.length,
        },
    ];
    selectedManageCategoryId.value = id;
    newCategoryLabel.value = "";
};

const updateSelectedDraftCategoryLabel = (event: Event) => {
    const category = selectedDraftCategory.value;
    if (!category) {
        return;
    }
    const target = event.target as HTMLInputElement | null;
    const label = target?.value.trim() || category.label;
    draftCategories.value = draftCategories.value.map((entry) =>
        entry.id === category.id ? { ...entry, label } : entry,
    );
};

const deleteSelectedDraftCategory = () => {
    const category = selectedDraftCategory.value;
    if (!category) {
        return;
    }
    const confirmed =
        !import.meta.client ||
        window.confirm(`Delete category "${category.label}" and remove its assignments?`);
    if (!confirmed) {
        return;
    }
    draftCategories.value = draftCategories.value
        .filter((entry) => entry.id !== category.id)
        .map((entry, index) => ({ ...entry, order: index }));
    draftAssignments.value = Object.fromEntries(
        Object.entries(draftAssignments.value)
            .map(([componentId, categoryIds]) => [
                componentId,
                categoryIds.filter((categoryId) => categoryId !== category.id),
            ])
            .filter(([, categoryIds]) => categoryIds.length > 0),
    );
    selectedManageCategoryId.value = draftCategories.value[0]?.id ?? "";
};

const isComponentAssignedToSelectedCategory = (componentId: string): boolean => {
    const category = selectedDraftCategory.value;
    if (!category) {
        return false;
    }
    return draftAssignments.value[componentId]?.includes(category.id) ?? false;
};

const toggleComponentAssignment = (componentId: string) => {
    const category = selectedDraftCategory.value;
    if (!category) {
        return;
    }
    const current = draftAssignments.value[componentId] ?? [];
    const next = current.includes(category.id)
        ? current.filter((categoryId) => categoryId !== category.id)
        : [...current, category.id];
    if (next.length === 0) {
        const { [componentId]: _removed, ...rest } = draftAssignments.value;
        draftAssignments.value = rest;
        return;
    }
    draftAssignments.value = {
        ...draftAssignments.value,
        [componentId]: next,
    };
};

const saveManageCategories = async () => {
    const normalized = normalizeComponentPickerCategorySettings({
        _rev: categorySettings.value._rev,
        categories: draftCategories.value.map((category, index) => ({
            ...category,
            order: index,
        })),
        assignments: draftAssignments.value,
    });
    await saveCategorySettings(normalized);
    cloneCategorySettingsToDraft();
    manageCategoriesOpen.value = false;
};

const close = () => {
    emit("close");
    searchQuery.value = "";
    selectedCategory.value = "default";
    previewDevice.value = "desktop";
    manageCategoriesOpen.value = false;
    closeExpanded();
};

const handlePickerKeydown = (event: KeyboardEvent) => {
    if (!props.isOpen || event.key !== "Escape") {
        return;
    }
    event.preventDefault();
    close();
};

const select = (id: string) => {
    emit("select", id);
    close();
};

/**
 * Scrolls the same-origin thumbnail iframe without letting clickable preview
 * content receive mouse events. If the iframe cannot scroll further, the wheel
 * event falls through to the component picker grid.
 */
const handlePreviewThumbnailWheel = (event: WheelEvent) => {
    const layer = event.currentTarget as HTMLElement | null;
    const iframe = layer
        ?.closest(".preview-pane")
        ?.querySelector("iframe") as HTMLIFrameElement | null;
    const frameDocument =
        iframe?.contentDocument ?? iframe?.contentWindow?.document ?? null;
    const scrollElement = frameDocument?.scrollingElement as HTMLElement | null;

    if (!scrollElement) {
        return;
    }

    const canScrollDown =
        event.deltaY > 0 &&
        scrollElement.scrollTop + scrollElement.clientHeight <
            scrollElement.scrollHeight - 1;
    const canScrollUp = event.deltaY < 0 && scrollElement.scrollTop > 0;
    const canScrollRight =
        event.deltaX > 0 &&
        scrollElement.scrollLeft + scrollElement.clientWidth <
            scrollElement.scrollWidth - 1;
    const canScrollLeft = event.deltaX < 0 && scrollElement.scrollLeft > 0;

    if (!(canScrollDown || canScrollUp || canScrollRight || canScrollLeft)) {
        return;
    }

    event.preventDefault();
    event.stopPropagation();
    scrollElement.scrollBy({
        left: event.deltaX,
        top: event.deltaY,
        behavior: "auto",
    });
};

const getDefaultProps = (def: ComponentDefinition) => {
    const defaults: Record<string, BuilderValue> = declaredPreviewDefaults(def);
    if (!def.props) return defaults;

    for (const prop of def.props) {
        if (prop.default === undefined) {
            // Generate mock data based on type if no default is provided
            switch (prop.type) {
                case "text":
                case "textarea":
                    defaults[prop.key] = `[${prop.label}]`;
                    break;
                case "boolean":
                    defaults[prop.key] = false;
                    break;
                case "number":
                    defaults[prop.key] = 0;
                    break;
                case "select":
                    if (prop.options && prop.options.length > 0) {
                        defaults[prop.key] = prop.options[0].value;
                    }
                    break;
                case "jsonarray":
                case "stringarray":
                    defaults[prop.key] = [];
                    break;
                case "json":
                case "jsonobject":
                    defaults[prop.key] = {};
                    break;
            }
        }
    }
    const previewOverrides =
        def.previewProps &&
        typeof def.previewProps === "object" &&
        !Array.isArray(def.previewProps)
            ? (def.previewProps as Record<string, BuilderValue>)
            : {};

    return {
        ...defaults,
        ...previewOverrides,
    };
};

const getPreviewComponentId = (def: ComponentDefinition): string => {
    if (
        typeof def.previewComponentId === "string" &&
        def.previewComponentId.trim().length > 0
    ) {
        return def.previewComponentId;
    }
    return def.id;
};

const clampThumbnailColumns = (value: unknown): number => {
    const numeric =
        typeof value === "number"
            ? value
            : typeof value === "string"
              ? Number.parseInt(value, 10)
              : Number.NaN;
    if (!Number.isFinite(numeric)) {
        return THUMBNAIL_COLUMNS_MIN;
    }
    return Math.min(
        THUMBNAIL_COLUMNS_MAX,
        Math.max(THUMBNAIL_COLUMNS_MIN, Math.round(numeric))
    );
};

const interpolatePreviewScale = (
    columns: number,
    minScale: number,
    maxScale: number
): number => {
    const clampedColumns = clampThumbnailColumns(columns);
    if (THUMBNAIL_COLUMNS_MAX === THUMBNAIL_COLUMNS_MIN) {
        return minScale;
    }
    const normalized =
        (clampedColumns - THUMBNAIL_COLUMNS_MIN) /
        (THUMBNAIL_COLUMNS_MAX - THUMBNAIL_COLUMNS_MIN);
    const baseScale = maxScale - normalized * (maxScale - minScale);
    return Math.min(0.95, Math.max(0.08, baseScale * PREVIEW_SCALE_ADJUSTER));
};

const previewDesktopScale = computed(() =>
    interpolatePreviewScale(
        thumbnailColumns.value,
        DESKTOP_PREVIEW_SCALE_MIN,
        DESKTOP_PREVIEW_SCALE_MAX
    )
);

const previewMobileScale = computed(() =>
    interpolatePreviewScale(
        thumbnailColumns.value,
        MOBILE_PREVIEW_SCALE_MIN,
        MOBILE_PREVIEW_SCALE_MAX
    )
);

const componentPickerPreviewInlineSize = computed(() => {
    const columns = clampThumbnailColumns(thumbnailColumns.value);
    const gridInlineSize = componentGridInlineSize.value;
    if (gridInlineSize <= 0) {
        return 0;
    }

    const totalGap = COMPONENT_PICKER_GRID_GAP * Math.max(0, columns - 1);
    const cardInlineSize =
        (gridInlineSize - COMPONENT_PICKER_GRID_INLINE_PADDING - totalGap) / columns;
    return Math.max(0, cardInlineSize - COMPONENT_PICKER_CARD_PREVIEW_INLINE_PADDING);
});

/**
 * Returns the effective desktop preview scale without relying on CSS length
 * division, which the production CSS transformer warns about during build.
 */
const previewDesktopEffectiveScale = computed(() => {
    const previewInlineSize = componentPickerPreviewInlineSize.value;
    if (previewInlineSize <= 0) {
        return previewDesktopScale.value;
    }
    const fitScale = previewInlineSize / DESKTOP_PREVIEW_MIN_VIEWPORT_WIDTH;
    return Math.min(previewDesktopScale.value, fitScale);
});

/**
 * Returns the effective mobile preview scale, keeping the virtual viewport
 * between the configured minimum and maximum widths.
 */
const previewMobileEffectiveScale = computed(() => {
    const previewInlineSize = componentPickerPreviewInlineSize.value;
    if (previewInlineSize <= 0) {
        return previewMobileScale.value;
    }
    const minFitScale = previewInlineSize / MOBILE_PREVIEW_MAX_VIEWPORT_WIDTH;
    const maxFitScale = previewInlineSize / MOBILE_PREVIEW_MIN_VIEWPORT_WIDTH;
    return Math.min(Math.max(previewMobileScale.value, minFitScale), maxFitScale);
});

const previewGridStyle = computed<CSSProperties>(() => ({
    "--component-picker-columns": String(thumbnailColumns.value),
    "--component-picker-preview-scale-desktop-effective":
        previewDesktopEffectiveScale.value.toFixed(4),
    "--component-picker-preview-scale-mobile-effective":
        previewMobileEffectiveScale.value.toFixed(4),
}));

let componentGridResizeObserver: ResizeObserver | null = null;

const canUseDocument = () => typeof document !== "undefined";

/**
 * Stores the current component picker grid width so preview scale values can be
 * derived in TypeScript instead of through build-warning-prone CSS calculations.
 */
const updateComponentGridInlineSize = () => {
    componentGridInlineSize.value = componentGrid.value?.clientWidth ?? 0;
};

const loadThumbnailColumns = () => {
    if (!import.meta.client) {
        return;
    }
    const stored = window.localStorage.getItem(THUMBNAIL_COLUMNS_STORAGE_KEY);
    if (!stored) {
        return;
    }
    thumbnailColumns.value = clampThumbnailColumns(stored);
};

const persistThumbnailColumns = (value: number) => {
    if (!import.meta.client) {
        return;
    }
    window.localStorage.setItem(
        THUMBNAIL_COLUMNS_STORAGE_KEY,
        String(clampThumbnailColumns(value))
    );
};

const handleThumbnailColumnsInput = (event: Event) => {
    const target = event.target as HTMLInputElement | null;
    const nextValue = clampThumbnailColumns(target?.value ?? thumbnailColumns.value);
    if (thumbnailColumns.value !== nextValue) {
        thumbnailColumns.value = nextValue;
    }
    persistThumbnailColumns(nextValue);
};

onMounted(() => {
    loadThumbnailColumns();
    updateComponentGridInlineSize();
    if (props.isOpen && canUseDocument()) {
        document.addEventListener("keydown", handlePickerKeydown);
    }

    if (import.meta.client && componentGrid.value) {
        componentGridResizeObserver = new ResizeObserver(() => {
            updateComponentGridInlineSize();
        });
        componentGridResizeObserver.observe(componentGrid.value);
    }
});

onBeforeUnmount(() => {
    if (canUseDocument()) {
        document.removeEventListener("keydown", handlePickerKeydown);
    }
    componentGridResizeObserver?.disconnect();
    componentGridResizeObserver = null;
});

watch(
    () => props.isOpen,
    async (val) => {
        if (val) {
            if (canUseDocument()) {
                document.addEventListener("keydown", handlePickerKeydown);
            }
            await fetchCategorySettings();
            cloneCategorySettingsToDraft();
             nextTick(() => {
                searchInput.value?.focus();
            });
        } else {
            if (canUseDocument()) {
                document.removeEventListener("keydown", handlePickerKeydown);
            }
            selectedCategory.value = "default";
            previewDevice.value = "desktop";
            manageCategoriesOpen.value = false;
        }
    }
);

watch(
    () => categoryTabs.value,
    (tabs) => {
        if (!tabs.length) {
            return;
        }
        if (tabs.some((tab) => tab.id === selectedCategory.value)) {
            return;
        }
        selectedCategory.value = tabs[0].id;
    },
    { immediate: true },
);

watch(
    thumbnailColumns,
    (value) => {
        const normalized = clampThumbnailColumns(value);
        if (value !== normalized) {
            thumbnailColumns.value = normalized;
            return;
        }
        persistThumbnailColumns(normalized);
    },
    { immediate: false }
);

watch(
    manageCategoriesOpen,
    async (value) => {
        if (!value) {
            await nextTick();
            updateComponentGridInlineSize();
        }
    },
);
</script>



<style scoped>
.component-picker-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
}

.component-picker-modal {
    background: white;
    border-radius: 12px;
    width: 100%;
    max-width: 80vw;
    height: 85vh; /* Use fixed height to ensure consistent large canvas */
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    overflow: hidden; /* Clip children */
}

/* ... header styles same ... */

.component-picker-header {
    padding: 16px 24px;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0; /* Don't shrink header */
}

.component-picker-header h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
}

.component-picker-search {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
}

.search-icon {
    position: absolute;
    left: 10px;
    width: 16px;
    height: 16px;
    color: #9ca3af;
}

.component-picker-search input {
    width: 100%;
    padding: 8px 12px 8px 34px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
}

.component-picker-search input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

.close-button {
    background: none;
    border: none;
    cursor: pointer;
    color: #6b7280;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s;
}

.close-button:hover {
    background: #f3f4f6;
    color: #111827;
}

.close-button svg {
    width: 20px;
    height: 20px;
}

.component-picker-grid {
    flex: 1;
    min-height: 0; /* Crucial for scrolling in flex container */
    overflow-y: auto;
    padding: 24px;
    display: grid;
    grid-template-columns: repeat(var(--component-picker-columns, 2), minmax(0, 1fr));
    grid-auto-rows: max-content;
    gap: 20px;
    background: #f9fafb;
    overscroll-behavior: contain; /* Prevent parent scroll */
}

.component-picker-header-controls {
    display: inline-flex;
    align-items: center;
    gap: 8px;
}

.component-picker-manage-button {
    border: 1px solid #d1d5db;
    background: #ffffff;
    color: #374151;
    border-radius: 999px;
    padding: 7px 10px;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
}

.component-picker-manage-button:hover,
.component-picker-manage-button.is-active {
    border-color: #2563eb;
    color: #1d4ed8;
    background: #eff6ff;
}

.component-picker-view-toggle {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    background: #f3f4f6;
    border-radius: 999px;
    padding: 3px;
}

.component-picker-view-toggle__button {
    display: inline-grid;
    place-items: center;
    width: 34px;
    height: 30px;
    border: 0;
    background: transparent;
    border-radius: 999px;
    padding: 0;
    color: #4b5563;
    cursor: pointer;
    transition: all 0.2s ease;
}

.component-picker-view-toggle__button svg {
    width: 17px;
    height: 17px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
}

.component-picker-view-toggle__button.is-active {
    background: #ffffff;
    color: #111827;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.component-picker-sort-control {
    display: inline-flex;
    align-items: center;
}

.component-picker-density-control {
    display: grid;
    grid-template-columns: auto minmax(74px, 96px);
    align-items: center;
    column-gap: 8px;
    color: #374151;
    font-size: 0.78rem;
    font-weight: 600;
    line-height: 1.1;
}

.component-picker-density-control__meta {
    display: grid;
    gap: 2px;
    min-width: 46px;
}

.component-picker-density-control__label {
    color: #64748b;
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
}

.component-picker-density-control input[type="range"] {
    width: 96px;
    accent-color: #2563eb;
}

.component-picker-density-control__value {
    min-width: 0;
    text-align: left;
    color: #111827;
    font-size: 0.86rem;
}

.component-picker-tabs {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    border-bottom: 1px solid #e5e7eb;
    background: #ffffff;
    overflow-x: auto;
    flex-shrink: 0;
}

.component-picker-tab {
    border: 1px solid #d1d5db;
    background: #ffffff;
    color: #374151;
    border-radius: 999px;
    padding: 6px 12px;
    font-size: 0.8rem;
    font-weight: 600;
    line-height: 1;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
}

.component-picker-tab:hover {
    border-color: #93c5fd;
    color: #1d4ed8;
    background: #eff6ff;
}

.component-picker-tab.is-active {
    border-color: #2563eb;
    color: #ffffff;
    background: #2563eb;
}

.component-picker-manage {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
    background: #f9fafb;
}

.component-picker-manage__sidebar {
    border-right: 1px solid #e5e7eb;
    background: #ffffff;
    padding: 18px;
    overflow-y: auto;
}

.component-picker-manage__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
}

.component-picker-manage__head h4 {
    margin: 0;
    font-size: 0.95rem;
    color: #111827;
}

.component-picker-manage__status {
    font-size: 0.75rem;
    color: #6b7280;
}

.component-picker-manage__add {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
}

.component-picker-manage__add input,
.component-picker-manage__field input {
    min-width: 0;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    padding: 8px 10px;
    font-size: 0.85rem;
}

.component-picker-manage__add input {
    flex: 1;
}

.component-picker-manage__add button,
.component-picker-manage__actions button,
.component-picker-manage__delete {
    border: 1px solid #d1d5db;
    border-radius: 6px;
    background: #ffffff;
    color: #374151;
    padding: 8px 12px;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
}

.component-picker-manage__categories {
    display: grid;
    gap: 8px;
}

.component-picker-manage__category {
    border: 1px solid #e5e7eb;
    background: #ffffff;
    color: #374151;
    border-radius: 6px;
    padding: 9px 10px;
    text-align: left;
    font-weight: 700;
    cursor: pointer;
}

.component-picker-manage__category.is-active {
    border-color: #2563eb;
    background: #eff6ff;
    color: #1d4ed8;
}

.component-picker-manage__main {
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 18px;
    gap: 14px;
}

.component-picker-manage__toolbar {
    display: grid;
    grid-template-columns: minmax(160px, 1fr) minmax(220px, 1.2fr) auto;
    gap: 12px;
    align-items: end;
}

.component-picker-manage__field {
    display: grid;
    gap: 6px;
    color: #374151;
    font-size: 0.78rem;
    font-weight: 700;
}

.component-picker-manage__delete {
    color: #991b1b;
    border-color: #fecaca;
}

.component-picker-manage__assignments {
    flex: 1;
    min-height: 0;
    display: grid;
    align-content: start;
    gap: 8px;
    overflow-y: auto;
    padding-right: 4px;
}

.component-picker-manage__assignment {
    display: flex;
    align-items: center;
    gap: 10px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background: #ffffff;
    padding: 9px 10px;
}

.component-picker-manage__assignment span {
    display: grid;
    gap: 2px;
    min-width: 0;
}

.component-picker-manage__assignment strong {
    color: #111827;
    font-size: 0.85rem;
}

.component-picker-manage__assignment small {
    color: #6b7280;
    font-size: 0.74rem;
}

.component-picker-manage__empty,
.component-picker-manage__error {
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background: #ffffff;
    padding: 14px;
    color: #6b7280;
}

.component-picker-manage__error {
    border-color: #fecaca;
    color: #991b1b;
}

.component-picker-manage__actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}

.component-picker-manage__save {
    border-color: #2563eb !important;
    background: #2563eb !important;
    color: #ffffff !important;
}

.component-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s ease;
    display: flex;
    flex-direction: column;
    padding: 0;
    position: relative;
}

.component-card:hover {
    border-color: #3b82f6;
    transform: translateY(-2px);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

.component-card-preview {
    aspect-ratio: 4 / 3;
    height: auto;
    background: #f3f4f6;
    position: relative;
    overflow: hidden;
    display: flex;
    padding: 12px;
    gap: 12px;
    border-bottom: 1px solid #e5e7eb;
}

.component-picker-grid.is-mobile-grid .component-card-preview {
    aspect-ratio: 9 / 16;
}

.expand-preview-btn,
.delete-global-component-btn {
    position: absolute;
    top: 8px;
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    padding: 4px;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.2s, background 0.2s;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
}

.expand-preview-btn {
    right: 8px;
}

.delete-global-component-btn {
    right: 42px;
}

.expand-preview-btn svg,
.delete-global-component-btn svg {
    width: 16px;
    height: 16px;
    color: #4b5563;
}

.component-card:hover .expand-preview-btn,
.component-card:hover .delete-global-component-btn {
    opacity: 1;
}

.expand-preview-btn:hover {
    background: white;
    border-color: #3b82f6;
}

.expand-preview-btn:hover svg {
    color: #3b82f6;
}

.delete-global-component-btn:hover {
    background: white;
    border-color: #dc2626;
}

.delete-global-component-btn:hover svg {
    color: #dc2626;
}

/* ... preview styles same ... */
.preview-pane {
    flex: 1;
    min-width: 0;
    min-height: 0;
    container-type: inline-size;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    overflow: hidden;
    position: relative;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.component-picker-preview-hit-layer {
    position: absolute;
    inset: 0;
    z-index: 5;
    cursor: pointer;
    background: transparent;
    touch-action: pan-y;
}

.primitive-preview {
    width: 100%;
    height: 100%;
    padding: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(180deg, #ffffff 0%, #f9fafb 100%);
}

.primitive-preview--paragraph {
    align-items: flex-start;
    justify-content: flex-start;
    flex-direction: column;
    gap: 8px;
}

.primitive-preview__line {
    display: block;
    height: 8px;
    width: 100%;
    border-radius: 999px;
    background: #d1d5db;
}

.primitive-preview__line--short {
    width: 68%;
}

.primitive-preview__line--medium {
    width: 82%;
}

.primitive-preview__inline {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    justify-content: center;
}

.primitive-preview__token {
    padding: 5px 9px;
    border: 1px solid #d1d5db;
    border-radius: 999px;
    background: #ffffff;
    color: #374151;
    font-size: 0.72rem;
    font-weight: 600;
}

.primitive-preview__token--muted {
    color: #6b7280;
    background: #f9fafb;
}

.primitive-preview__token--strong {
    border-color: #93c5fd;
    color: #1d4ed8;
    background: #eff6ff;
    font-weight: 700;
}

.primitive-preview__slot {
    width: 100%;
    border: 1px dashed #cbd5e1;
    border-radius: 10px;
    padding: 14px;
    text-align: center;
    background: #ffffff;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.primitive-preview__slot-label {
    font-size: 0.72rem;
    font-weight: 700;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

.primitive-preview__slot-content {
    font-size: 0.78rem;
    color: #64748b;
}

.preview-lazy-loader {
    width: 100%;
    height: 100%;
    min-height: 100%;
}

.preview-lazy-loader :deep(.preview-frame-container),
.preview-lazy-loader :deep(.preview-iframe) {
    width: 100% !important;
    height: 100% !important;
}

.preview-lazy-loader :deep(.component-picker-preview-fill-target),
.expanded-content :deep(.component-picker-preview-fill-target) {
    width: 100% !important;
    max-width: 100% !important;
}

.preview-scaler {
    width: 100%;
    height: 100%;
    transform-origin: top left;
    overflow: hidden;
    pointer-events: none;
}

.preview-scaler.is-desktop {
    width: calc(100% / var(--component-picker-preview-scale-desktop-effective, 0.25));
    height: calc(100% / var(--component-picker-preview-scale-desktop-effective, 0.25));
    transform: scale(var(--component-picker-preview-scale-desktop-effective, 0.25));
}

.preview-scaler.is-mobile {
    width: calc(100% / var(--component-picker-preview-scale-mobile-effective, 0.33));
    height: calc(100% / var(--component-picker-preview-scale-mobile-effective, 0.33));
    transform: scale(var(--component-picker-preview-scale-mobile-effective, 0.33));
}


.component-card-footer {
    padding: 12px 16px;
    background: white;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.component-info {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
}

.component-info__main {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 2px;
}

.component-name {
    font-weight: 600;
    font-size: 0.95rem;
    color: #111827;
}

.component-updated-at {
    color: #6b7280;
    font-size: 0.72rem;
    line-height: 1.2;
}

.component-id {
    flex-shrink: 0;
    font-size: 0.75rem;
    color: #9ca3af;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.component-description {
    margin: 0;
    font-size: 0.8rem;
    color: #6b7280;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

/* Expanded Modal Styles */
.expanded-preview-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
}

.expanded-preview-modal {
    background: white;
    border-radius: 12px;
    width: 100%;
    max-width: 1200px;
    height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    overflow: hidden;
}

.expanded-header {
    padding: 16px 24px;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: white;
}

.expanded-header h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
}

.expanded-controls {
    display: flex;
    align-items: center;
    gap: 24px;
}

.device-toggles {
    display: flex;
    background: #f3f4f6;
    padding: 4px;
    border-radius: 8px;
    gap: 4px;
}

.device-toggles button {
    background: none;
    border: none;
    padding: 6px 10px;
    border-radius: 6px;
    cursor: pointer;
    color: #6b7280;
    display: flex;
    align-items: center;
    transition: all 0.2s;
}

.device-toggles button.active {
    background: white;
    color: #111827;
    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.action-buttons {
    display: flex;
    align-items: center;
    gap: 12px;
}

.select-btn {
    background: #2563eb;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
}

.select-btn:hover {
    background: #1d4ed8;
}

.close-expanded-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: #6b7280;
    padding: 8px;
    border-radius: 6px;
    transition: all 0.2s;
    display: flex;
    align-items: center;
}

.close-expanded-btn:hover {
    background: #f3f4f6;
    color: #111827;
}

.expanded-content {
    flex: 1;
    background: #f9fafb;
    overflow: hidden;
    display: flex;
    align-items: center; /* Center horizontally/vertically roughly */
    justify-content: center;
    padding: 40px;
}

.expanded-frame-wrapper {
    height: 100%;
    background: white;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    transition: width 0.3s ease;
    overflow: hidden; /* Iframe container handles scroll */
}

/* Ensure iframe in full view handles scrolling */
.full-size-frame :deep(iframe) {
    height: 100% !important;
}
</style>
