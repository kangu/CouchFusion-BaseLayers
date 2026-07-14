<script setup lang="ts">
import type { PreviewDevice } from "#content/app/utils/component-preview";
import RichTooltip from "../ui/RichTooltip.vue";

defineProps<{
  modelValue: PreviewDevice;
}>();

const emit = defineEmits<{
  "update:modelValue": [device: PreviewDevice];
}>();
</script>

<template>
  <div class="preview-device-toggle" role="group" aria-label="Preview device">
    <RichTooltip
      title="Desktop preview"
      description="Show the component at desktop width."
    >
      <template #default="{ describedby }">
        <button
          type="button"
          aria-label="Desktop preview"
          :aria-describedby="describedby"
          :aria-pressed="modelValue === 'desktop'"
          :class="{ 'is-active': modelValue === 'desktop' }"
          @click="emit('update:modelValue', 'desktop')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="4" width="18" height="12" rx="2" />
            <path d="M8 20h8M12 16v4" />
          </svg>
        </button>
      </template>
    </RichTooltip>
    <RichTooltip
      title="Mobile preview"
      description="Show the component at mobile width."
    >
      <template #default="{ describedby }">
        <button
          type="button"
          aria-label="Mobile preview"
          :aria-describedby="describedby"
          :aria-pressed="modelValue === 'mobile'"
          :class="{ 'is-active': modelValue === 'mobile' }"
          @click="emit('update:modelValue', 'mobile')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="7" y="2.5" width="10" height="19" rx="2" />
            <path d="M11.8 18h.4" />
          </svg>
        </button>
      </template>
    </RichTooltip>
  </div>
</template>

<style scoped>
.preview-device-toggle {
  display: flex;
  gap: 0.25rem;
  padding: 0.25rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  background: #f3f4f6;
}

button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 0;
  border-radius: 0.375rem;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
}

button:hover,
button:focus-visible {
  color: #111827;
}

button:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 1px;
}

button.is-active {
  background: #fff;
  color: #111827;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

svg {
  width: 1.125rem;
  height: 1.125rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
}
</style>
