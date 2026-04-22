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
                    <div class="component-picker-view-toggle">
                        <button
                            type="button"
                            class="component-picker-view-toggle__button"
                            :class="{ 'is-active': previewDevice === 'desktop' }"
                            @click="previewDevice = 'desktop'"
                        >
                            Desktop
                        </button>
                        <button
                            type="button"
                            class="component-picker-view-toggle__button"
                            :class="{ 'is-active': previewDevice === 'mobile' }"
                            @click="previewDevice = 'mobile'"
                        >
                            Mobile
                        </button>
                    </div>
                    <label class="component-picker-density-control" for="component-picker-thumbnail-columns">
                        <span class="component-picker-density-control__label">Thumbnails</span>
                        <input
                            id="component-picker-thumbnail-columns"
                            v-model.number="thumbnailColumns"
                            type="range"
                            :min="THUMBNAIL_COLUMNS_MIN"
                            :max="THUMBNAIL_COLUMNS_MAX"
                            step="1"
                            @input="handleThumbnailColumnsInput"
                        />
                        <span class="component-picker-density-control__value">{{ thumbnailColumns }}</span>
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
            <div
                class="component-picker-grid"
                :class="{ 'is-mobile-grid': previewDevice === 'mobile' }"
                :style="{
                    '--component-picker-columns': String(thumbnailColumns),
                    '--component-picker-preview-scale-desktop': previewDesktopScale.toFixed(4),
                    '--component-picker-preview-scale-mobile': previewMobileScale.toFixed(4),
                    '--component-picker-preview-desktop-min-width': `${DESKTOP_PREVIEW_MIN_VIEWPORT_WIDTH}px`,
                    '--component-picker-preview-mobile-min-width': `${MOBILE_PREVIEW_MIN_VIEWPORT_WIDTH}px`
                }"
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
                        </div>
                        <button class="expand-preview-btn" @click.stop="expandComponent(comp)" title="Expand Preview">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                            </svg>
                        </button>
                    </div>
                    <div class="component-card-footer" @click="select(comp.id)">
                        <div class="component-info">
                            <span class="component-name">{{ comp.label }}</span>
                            <span class="component-id">{{ comp.id }}</span>
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
                        <div class="device-toggles">
                            <button
                                :class="{ active: expandedDevice === 'desktop' }"
                                @click="expandedDevice = 'desktop'"
                                title="Desktop View"
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                                    <line x1="8" y1="21" x2="16" y2="21" />
                                    <line x1="12" y1="17" x2="12" y2="21" />
                                </svg>
                            </button>
                            <button
                                :class="{ active: expandedDevice === 'mobile' }"
                                @click="expandedDevice = 'mobile'"
                                title="Mobile View"
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                                    <line x1="12" y1="18" x2="12" y2="18" />
                                </svg>
                            </button>
                        </div>
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
import { ref, computed, nextTick, watch, onMounted } from "vue";
import type { ComponentDefinition, BuilderValue } from "~/types/builder";
import PreviewFrame from "./PreviewFrame.vue";
import LazyLoader from "./LazyLoader.vue";

const props = defineProps<{
    isOpen: boolean;
    componentOptions: ComponentDefinition[];
}>();

const emit = defineEmits<{
    (e: "close"): void;
    (e: "select", id: string): void;
}>();

const searchQuery = ref("");
const searchInput = ref<HTMLInputElement | null>(null);
const selectedCategory = ref("default");
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
const MOBILE_PREVIEW_MIN_VIEWPORT_WIDTH = 420;
// Global multiplier for thumbnail preview zoom density.
// Increase for larger previews, decrease for smaller.
const PREVIEW_SCALE_ADJUSTER = 1.2;

const expandedComp = ref<ComponentDefinition | null>(null);
const expandedDevice = ref<'desktop' | 'mobile'>('desktop');

const expandComponent = (comp: ComponentDefinition) => {
    expandedComp.value = comp;
    expandedDevice.value = 'desktop';
};

const closeExpanded = () => {
    expandedComp.value = null;
};

const PRIMITIVE_COMPONENT_IDS = new Set(["p", "span", "strong", "template"]);
const PRIMITIVE_COMPONENT_LABELS = new Set([
    "paragraph",
    "span",
    "strong text",
    "template (slot)",
    "template",
]);

const normalizeCategory = (value?: string): string => {
    if (typeof value !== "string") {
        return "default";
    }
    const trimmed = value.trim().toLowerCase();
    return trimmed.length > 0 ? trimmed : "default";
};

const formatCategoryLabel = (value: string): string => {
    if (value === "all") {
        return "All";
    }
    if (value === "basic-html") {
        return "Basic HTML";
    }
    if (value === "default") {
        return "Sections";
    }
    return value
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(" ");
};

const isPrimitiveComponent = (definition: ComponentDefinition): boolean => {
    const id = definition.id.trim().toLowerCase();
    const label = definition.label.trim().toLowerCase();
    return PRIMITIVE_COMPONENT_IDS.has(id) || PRIMITIVE_COMPONENT_LABELS.has(label);
};

const normalizeComponentCategory = (definition: ComponentDefinition): string => {
    if (isPrimitiveComponent(definition)) {
        return "basic-html";
    }
    return normalizeCategory(definition.category);
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
    const discovered = new Set<string>();
    for (const definition of props.componentOptions) {
        discovered.add(normalizeComponentCategory(definition));
    }

    const ordered = Array.from(discovered.values()).sort((left, right) =>
        left.localeCompare(right)
    );
    const prioritized = [
        ...ordered.filter((value) => value === "default"),
        ...ordered.filter((value) => value === "global"),
        ...ordered.filter((value) => value === "basic-html"),
        ...ordered.filter(
            (value) =>
                value !== "default" &&
                value !== "global" &&
                value !== "basic-html"
        ),
    ];

    return [
        { id: "all", label: "All" },
        ...prioritized.map((id) => ({
            id,
            label: formatCategoryLabel(id)
        }))
    ];
});

const filteredComponents = computed(() => {
    const selected = selectedCategory.value;
    const byCategory =
        selected === "all"
            ? props.componentOptions
            : props.componentOptions.filter(
                  (component) =>
                      normalizeComponentCategory(component) === selected
              );

    if (!searchQuery.value.trim()) return byCategory;
    const q = searchQuery.value.toLowerCase();
    return byCategory.filter(
        (c) =>
            c.label.toLowerCase().includes(q) ||
            c.id.toLowerCase().includes(q) ||
            normalizeComponentCategory(c).includes(q)
    );
});

const close = () => {
    emit("close");
    searchQuery.value = "";
    selectedCategory.value = "default";
    previewDevice.value = "desktop";
    closeExpanded();
};

const select = (id: string) => {
    emit("select", id);
    close();
};

const getDefaultProps = (def: ComponentDefinition) => {
    const defaults: Record<string, BuilderValue> = {};
    if (!def.props) return defaults;

    for (const prop of def.props) {
        if (prop.default !== undefined) {
            defaults[prop.key] = prop.default;
        } else {
            // Generate mock data based on type if no default is provided
            switch (prop.type) {
                case 'text':
                case 'textarea':
                    defaults[prop.key] = `[${prop.label}]`;
                    break;
                case 'boolean':
                    defaults[prop.key] = false;
                    break;
                case 'number':
                    defaults[prop.key] = 0;
                    break;
                case 'select':
                    if (prop.options && prop.options.length > 0) {
                        defaults[prop.key] = prop.options[0].value;
                    }
                    break;
                case 'jsonarray':
                case 'stringarray':
                    defaults[prop.key] = [];
                    break;
                case 'json':
                case 'jsonobject':
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
});

watch(
    () => props.isOpen,
    (val) => {
        if (val) {
             nextTick(() => {
                searchInput.value?.focus();
            });
        } else {
            selectedCategory.value = "default";
            previewDevice.value = "desktop";
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
    gap: 16px;
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
    gap: 12px;
}

.component-picker-view-toggle {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: #f3f4f6;
    border-radius: 999px;
    padding: 4px;
}

.component-picker-view-toggle__button {
    border: 0;
    background: transparent;
    border-radius: 999px;
    padding: 6px 10px;
    color: #4b5563;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
}

.component-picker-view-toggle__button.is-active {
    background: #ffffff;
    color: #111827;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.component-picker-density-control {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: #374151;
    font-size: 0.78rem;
    font-weight: 600;
}

.component-picker-density-control__label {
    white-space: nowrap;
}

.component-picker-density-control input[type="range"] {
    width: 120px;
    accent-color: #2563eb;
}

.component-picker-density-control__value {
    min-width: 1.25rem;
    text-align: right;
    color: #111827;
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

.expand-preview-btn {
    position: absolute;
    top: 8px;
    right: 8px;
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

.expand-preview-btn svg {
    width: 16px;
    height: 16px;
    color: #4b5563;
}

.component-card:hover .expand-preview-btn {
    opacity: 1;
}

.expand-preview-btn:hover {
    background: white;
    border-color: #3b82f6;
}

.expand-preview-btn:hover svg {
    color: #3b82f6;
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
    --component-picker-preview-scale-desktop-fit: calc(
        100cqw / var(--component-picker-preview-desktop-min-width, 1280px)
    );
    --component-picker-preview-scale-desktop-effective: min(
        var(--component-picker-preview-scale-desktop, 0.25),
        var(--component-picker-preview-scale-desktop-fit)
    );
    width: calc(100% / var(--component-picker-preview-scale-desktop-effective, 0.25));
    height: calc(100% / var(--component-picker-preview-scale-desktop-effective, 0.25));
    transform: scale(var(--component-picker-preview-scale-desktop-effective, 0.25));
}

.preview-scaler.is-mobile {
    --component-picker-preview-scale-mobile-fit: calc(
        100cqw / var(--component-picker-preview-mobile-min-width, 420px)
    );
    --component-picker-preview-scale-mobile-effective: min(
        var(--component-picker-preview-scale-mobile, 0.33),
        var(--component-picker-preview-scale-mobile-fit)
    );
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

.component-name {
    font-weight: 600;
    font-size: 0.95rem;
    color: #111827;
}

.component-id {
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
