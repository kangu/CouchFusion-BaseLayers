
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
                    @click="select(comp.id)"
                    @keydown.enter="select(comp.id)"
                    @keydown.space.prevent="select(comp.id)"
                >
                    <div class="component-card-preview">
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
                    </div>
                    <div class="component-card-footer">
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
}

.component-card:hover {
    border-color: #3b82f6;
    transform: translateY(-2px);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

/* ... preview styles same ... */
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
</style>
