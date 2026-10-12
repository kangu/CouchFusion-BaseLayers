<script setup lang="ts">
/**
 * Editable list of report steps ({ type: path|event, value }).
 */
// props
const props = withDefaults(defineProps<{
  modelValue: Array<{ type: string; value: string }>;
  min?: number;
  max?: number;
  label?: string;
}>(), { min: 1, max: 10, label: "Step" });
const emit = defineEmits<{ "update:modelValue": [value: Array<{ type: string; value: string }>] }>();

// local page api
const update = (index: number, patch: Record<string, string>) => {
  emit("update:modelValue", props.modelValue.map((step, i) => (i === index ? { ...step, ...patch } : step)));
};
const add = () => emit("update:modelValue", [...props.modelValue, { type: "path", value: "" }]);
const remove = (index: number) => emit("update:modelValue", props.modelValue.filter((_, i) => i !== index));
</script>

<template>
  <div class="cfa-stack" style="gap: 6px">
    <div v-for="(step, index) in modelValue" :key="index" class="cfa-row">
      <span class="cfa-badge">{{ label }} {{ index + 1 }}</span>
      <select class="cfa-select" :value="step.type" @change="update(index, { type: ($event.target as HTMLSelectElement).value })">
        <option value="path">Page</option>
        <option value="event">Event</option>
      </select>
      <input class="cfa-input" :value="step.value" :placeholder="step.type === 'path' ? '/pricing or /blog/*' : 'signup'" @input="update(index, { value: ($event.target as HTMLInputElement).value })" />
      <button v-if="modelValue.length > min" type="button" class="cfa-btn cfa-btn-sm" @click="remove(index)">Remove</button>
    </div>
    <div><button v-if="modelValue.length < max" type="button" class="cfa-btn cfa-btn-sm" @click="add">+ {{ label }}</button></div>
  </div>
</template>
