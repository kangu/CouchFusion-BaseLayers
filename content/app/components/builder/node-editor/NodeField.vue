<template>
    <component
        :is="tag"
        class="node-panel__field"
        :class="{
            'is-row': isRow,
            'node-panel__field--match': isMatch,
            'node-panel__field--localized': isLocalized,
        }"
        :role="role"
        v-on="listeners"
    >
        <span v-if="isRow" class="node-panel__field-copy">
            <span>{{ label }}</span>
            <small
                v-if="description"
                class="node-panel__field-description"
            >
                {{ description }}
            </small>
        </span>
        <span v-else>{{ label }}</span>
        <slot />
        <small v-if="error" class="node-panel__error">{{ error }}</small>
        <small v-if="description && !isRow">{{ description }}</small>
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
        isLocalized?: boolean;
        description?: string;
        error?: string | null;
    }>(),
    {
        tag: "label",
        listeners: () => ({}),
        isRow: false,
        isMatch: false,
        isLocalized: false,
        description: undefined,
        error: null,
    },
);
</script>
