<script setup lang="ts">
import { computed, toRef } from "vue";
import { Icon as IconifyIcon } from "@iconify/vue";

const props = withDefaults(
  defineProps<{
    name: string;
    size?: string | number;
    label?: string;
    role?: string;
  }>(),
  {
    size: "1em",
    label: undefined,
    role: undefined,
  },
);

const name = toRef(props, "name");
const size = toRef(props, "size");
const label = toRef(props, "label");
const explicitRole = toRef(props, "role");

const resolvedRole = computed(
  () => explicitRole.value ?? (label.value ? "img" : "presentation"),
);
const resolvedAriaHidden = computed(() => (label.value ? undefined : "true"));
</script>

<template>
  <component
    :is="IconifyIcon"
    :icon="name"
    :width="size"
    :height="size"
    :role="resolvedRole"
    :aria-label="label"
    :aria-hidden="resolvedAriaHidden"
    v-bind="$attrs"
  />
</template>
