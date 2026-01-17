<template>
    <div class="node-panel__insert-dialog">
        <div
            class="node-panel__insert-backdrop"
            @click="closeInsertDialog"
        ></div>
        <div class="node-panel__insert-content">
            <header class="node-panel__insert-header">
                <h3>Select insertion point</h3>
                <button
                    type="button"
                    class="node-panel__insert-close"
                    @click="closeInsertDialog"
                >
                    ×
                </button>
            </header>
            <p class="node-panel__insert-subtitle">
                Choose where to place the new
                {{ insertDialog.type === "jsonarray" ? "entry" : "text item" }}.
            </p>
            <ul class="node-panel__insert-options">
                <li
                    v-for="option in getInsertPositions()"
                    :key="`${insertDialog.key}-${option.index}`"
                >
                    <button type="button" @click="handleInsertAt(option.index)">
                        <strong>Position {{ option.index + 1 }}</strong>
                        <span>{{ option.preview }}</span>
                    </button>
                </li>
            </ul>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { ComponentPropSchema } from "~/types/builder";

type InsertDialogState = {
    key: string | null;
    type: "jsonarray" | "stringarray" | null;
    schema: ComponentPropSchema | null;
};

type InsertPosition = { index: number; preview: string };

type Props = {
    insertDialog: InsertDialogState;
    getInsertPositions: () => InsertPosition[];
    handleInsertAt: (index: number) => void;
    closeInsertDialog: () => void;
};

defineProps<Props>();
</script>
