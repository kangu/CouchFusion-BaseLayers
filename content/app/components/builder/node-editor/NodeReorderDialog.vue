<template>
    <div class="node-panel__insert-dialog">
        <div
            class="node-panel__insert-backdrop"
            @click="closeReorderDialog"
        ></div>
        <div class="node-panel__insert-content node-panel__insert-content--small">
            <header class="node-panel__insert-header">
                <h3>Move item</h3>
                <button
                    type="button"
                    class="node-panel__insert-close"
                    @click="closeReorderDialog"
                >
                    ×
                </button>
            </header>
            <p class="node-panel__insert-subtitle">
                Set a new position (1-{{ maxIndex }}) for this entry.
            </p>
            <div class="node-panel__reorder-input">
                <label>
                    New position
                    <input
                        v-model.number="modelIndex"
                        type="number"
                        min="1"
                        :max="maxIndex"
                    />
                </label>
            </div>
            <div class="node-panel__insert-actions">
                <button
                    type="button"
                    class="node-panel__insert-confirm"
                    @click="confirmReorderDialog"
                >
                    Move item
                </button>
                <button
                    type="button"
                    class="node-panel__insert-cancel"
                    @click="closeReorderDialog"
                >
                    Cancel
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

type Props = {
    maxIndex: number;
    newIndex: number;
    confirmReorderDialog: () => void;
    closeReorderDialog: () => void;
};

const props = defineProps<Props>();

const emit = defineEmits<{
    (event: "update:newIndex", value: number): void;
}>();

const modelIndex = computed({
    get: () => props.newIndex,
    set: (value) => emit("update:newIndex", value),
});
</script>
