<template>
    <component
        :is="tag"
        class="node-panel__field"
        :class="{
            'is-row': isRow,
            'node-panel__field--match': isMatch,
        }"
        :role="role"
        v-on="listeners"
    >
        <span>{{ label }}</span>
        <slot />
        <small v-if="error" class="node-panel__error">{{ error }}</small>
        <small v-if="description">{{ description }}</small>
    </component>
</template>

<script setup lang="ts">
withDefaults(
    defineProps<{
        label: string;
        tag?: string;
        role?: string;
        listeners?: Record<string, (event: Event) => void>;
        isRow?: boolean;
        isMatch?: boolean;
        description?: string;
        error?: string | null;
    }>(),
    {
        tag: "label",
        listeners: () => ({}),
        isRow: false,
        isMatch: false,
        description: undefined,
        error: null,
    },
);
</script>
