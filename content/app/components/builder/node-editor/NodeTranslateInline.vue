<template>
    <span class="node-panel__translate-inline-wrap">
        <input
            type="checkbox"
            class="node-panel__translate-select"
            :checked="selected"
            :aria-label="checkboxAriaLabel"
            title="Select for batch translation"
            @change="handleChange"
        />
        <button
            type="button"
            class="node-panel__translate-inline"
            @click="$emit('translate')"
        >
            Translate
        </button>
    </span>
</template>

<script setup lang="ts">
withDefaults(
    defineProps<{
        selected?: boolean;
        checkboxAriaLabel?: string;
    }>(),
    {
        selected: false,
        checkboxAriaLabel: "Select translation field",
    },
);

const emit = defineEmits<{
    (e: "toggle", selected: boolean): void;
    (e: "translate"): void;
}>();

const handleChange = (event: Event) => {
    const target = event.target as HTMLInputElement | null;
    emit("toggle", Boolean(target?.checked));
};
</script>
