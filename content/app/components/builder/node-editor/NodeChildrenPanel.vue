<template>
    <div v-if="allowChildren" class="node-panel__children">
        <div class="node-panel__children-actions">
            <button
                type="button"
                class="node-panel__add-btn"
                @click="openPicker"
            >
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Add child component
            </button>
            <button
                type="button"
                class="node-panel__add-btn node-panel__add-btn--secondary"
                @click="onAddChildText(nodeUid)"
            >
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <path
                        d="M4 7V4h16v3M9 20h6M12 4v16"
                    />
                </svg>
                Add text
            </button>
        </div>
        <p v-if="childHint" class="node-panel__hint">
            {{ childHint }}
        </p>
        <template v-for="child in children" :key="child.uid">
            <slot name="child" :child="child" />
        </template>

        <ComponentPickerDialog
            :is-open="isPickerOpen"
            :component-options="componentOptions"
            @close="closePicker"
            @select="handleComponentSelect"
        />
    </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { BuilderNodeChild, ComponentDefinition } from "~/types/builder";
import ComponentPickerDialog from "../ComponentPickerDialog.vue";

type AddChildTextHandler = (uid: string) => void;
// Updated signature to accept componentId
type AddChildComponentHandler = (componentId: string) => void;

type ChildSlotProps = {
    child: BuilderNodeChild;
};

defineSlots<{ child?: (props: ChildSlotProps) => any }>();

const props = withDefaults(
    defineProps<{
        allowChildren: boolean;
        // modelValue is no longer needed for selection but kept for prop compat if needed (though we'll ignore it)
        modelValue?: string;
        componentOptions: ComponentDefinition[];
        nodeUid: string;
        childHint?: string;
        children: BuilderNodeChild[];
        onAddChildComponent: AddChildComponentHandler;
        onAddChildText: AddChildTextHandler;
    }>(),
    {
        childHint: "",
    },
);

// We don't emit update:modelValue anymore for selection

const isPickerOpen = ref(false);

const openPicker = () => {
    isPickerOpen.value = true;
};

const closePicker = () => {
    isPickerOpen.value = false;
};

const handleComponentSelect = (id: string) => {
    props.onAddChildComponent(id);
};
</script>

<style scoped>
.node-panel__children-actions {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
}

.node-panel__add-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: #f3f4f6;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    cursor: pointer;
    transition: all 0.2s;
}

.node-panel__add-btn:hover {
    background: #e5e7eb;
    border-color: #9ca3af;
}

.node-panel__add-btn--secondary {
    background: white;
    color: #6b7280;
}
</style>
