<script setup lang="ts">
import { computed, onMounted, shallowRef, toRef } from "vue";

interface IconComponent {
  [key: string]: unknown;
}

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
const iconifyComponent = shallowRef<IconComponent | null>(null);

onMounted(async () => {
  try {
    const moduleName = "@iconify/vue";
    const iconifyModule = await import(
      /* @vite-ignore */ moduleName
    );
    iconifyComponent.value = (iconifyModule as { Icon?: IconComponent }).Icon ?? null;
  } catch {
    iconifyComponent.value = null;
  }
});
</script>

<template>
  <component
    :is="iconifyComponent"
    v-if="iconifyComponent"
    :icon="name"
    :width="size"
    :height="size"
    :role="resolvedRole"
    :aria-label="label"
    :aria-hidden="resolvedAriaHidden"
    v-bind="$attrs"
  />
  <span
    v-else
    class="inline-block rounded-full bg-current opacity-60"
    :style="{
      width: typeof size === 'number' ? `${size}px` : size,
      height: typeof size === 'number' ? `${size}px` : size,
      minWidth: typeof size === 'number' ? `${size}px` : size,
      minHeight: typeof size === 'number' ? `${size}px` : size,
    }"
    :role="resolvedRole"
    :aria-label="label || name"
    :aria-hidden="resolvedAriaHidden"
    v-bind="$attrs"
  />
</template>
