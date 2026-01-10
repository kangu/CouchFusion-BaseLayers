
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
                <button class="close-button" @click="close">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </header>
            <div class="component-picker-grid">
                <div
                    v-for="comp in filteredComponents"
                    :key="comp.id"
                    class="component-card"
                    role="button"
                    tabindex="0"
                    
                >
                    <div class="component-card-preview" @click="select(comp.id)">
                        <div class="preview-desktop">
                            <div class="preview-scaler">
                                <PreviewFrame :width="1024" :height="800">
                                    <component :is="comp.id" v-bind="getDefaultProps(comp)" />
                                </PreviewFrame>
                            </div>
                        </div>
                        <div class="preview-mobile">
                            <div class="preview-scaler">
                                <PreviewFrame :width="375" :height="800">
                                    <component :is="comp.id" v-bind="getDefaultProps(comp)" />
                                </PreviewFrame>
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
                            :width="expandedDevice === 'mobile' ? 375 : 1280" 
                            :height="800"
                            class="full-size-frame"
                        >
                            <component :is="expandedComp.id" v-bind="getDefaultProps(expandedComp)" />
                        </PreviewFrame>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from "vue";
import type { ComponentDefinition, BuilderValue } from "~/types/builder";
import PreviewFrame from "./PreviewFrame.vue";

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

const expandedComp = ref<ComponentDefinition | null>(null);
const expandedDevice = ref<'desktop' | 'mobile'>('desktop');

const expandComponent = (comp: ComponentDefinition) => {
    expandedComp.value = comp;
    expandedDevice.value = 'desktop';
};

const closeExpanded = () => {
    expandedComp.value = null;
};

const filteredComponents = computed(() => {
    if (!searchQuery.value.trim()) return props.componentOptions;
    const q = searchQuery.value.toLowerCase();
    return props.componentOptions.filter(
        (c) =>
            c.label.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
    );
});

const close = () => {
    emit("close");
    searchQuery.value = "";
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
    return defaults;
};

watch(
    () => props.isOpen,
    (val) => {
        if (val) {
             nextTick(() => {
                searchInput.value?.focus();
            });
        }
    }
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
    max-width: 900px;
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
    /* Adjusted to minmax 340px to favor 2 columns on typical desktop (900px max-width) */
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    grid-auto-rows: max-content;
    gap: 20px;
    background: #f9fafb;
    overscroll-behavior: contain; /* Prevent parent scroll */
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
    height: 200px;
    background: #f3f4f6;
    position: relative;
    overflow: hidden;
    display: flex;
    padding: 12px;
    gap: 12px;
    border-bottom: 1px solid #e5e7eb;
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
.preview-desktop {
    flex: 2;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    overflow: hidden;
    position: relative;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.preview-mobile {
    flex: 1;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    overflow: hidden;
    position: relative;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.preview-scaler {
    width: 400%; 
    height: 400%;
    transform: scale(0.25); 
    transform-origin: top left;
    pointer-events: none;
    overflow: hidden;
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
