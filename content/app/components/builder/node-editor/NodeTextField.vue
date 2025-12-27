<template>
    <div class="node-panel__input-wrap">
        <div
            v-if="showHighlight"
            class="node-panel__input-highlight node-panel__input-highlight--single"
            v-html="highlightMarkup"
            aria-hidden="true"
        />
        <input
            :value="modelValue ?? ''"
            :placeholder="placeholder"
            :type="inputType"
            @input="handleInput"
            @blur="handleBlur"
        />
    </div>
</template>

<script setup lang="ts">
const props = defineProps<{
    modelValue: string | number;
    placeholder?: string;
    inputType?: string;
    showHighlight?: boolean;
    highlightMarkup?: string;
}>();

const emit = defineEmits<{
    (event: "update:modelValue", value: string): void;
    (event: "input", value: Event): void;
    (event: "blur", value: FocusEvent): void;
}>();

const inputType = props.inputType ?? "text";

const handleInput = (event: Event) => {
    emit("update:modelValue", (event.target as HTMLInputElement).value);
    emit("input", event);
};

const handleBlur = (event: FocusEvent) => {
    emit("blur", event);
};
</script>
