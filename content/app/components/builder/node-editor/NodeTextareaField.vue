<template>
    <div class="node-panel__input-wrap">
        <div
            v-if="showHighlight"
            class="node-panel__input-highlight node-panel__input-highlight--multiline"
            v-html="highlightMarkup"
            aria-hidden="true"
        />
        <textarea
            :value="modelValue ?? ''"
            :placeholder="placeholder"
            :rows="rows"
            @input="handleInput"
            @blur="handleBlur"
            @scroll="handleScroll"
        />
    </div>
</template>

<script setup lang="ts">
const props = defineProps<{
    modelValue: string;
    placeholder?: string;
    rows?: number;
    showHighlight?: boolean;
    highlightMarkup?: string;
}>();

const emit = defineEmits<{
    (event: "update:modelValue", value: string): void;
    (event: "input", value: Event): void;
    (event: "blur", value: FocusEvent): void;
    (event: "scroll", value: Event): void;
}>();

const rows = props.rows ?? 3;

const handleInput = (event: Event) => {
    emit("update:modelValue", (event.target as HTMLTextAreaElement).value);
    emit("input", event);
};

const handleBlur = (event: FocusEvent) => {
    emit("blur", event);
};

const handleScroll = (event: Event) => {
    emit("scroll", event);
};
</script>
