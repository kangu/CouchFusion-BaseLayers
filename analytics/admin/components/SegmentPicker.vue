<script setup lang="ts">
/**
 * Saved segments (named filter sets): apply, save current filters, delete.
 */
import { ref, watch } from "vue";
import type { AnalyticsApi } from "../composables/useAnalyticsApi";
import { errorMessage } from "../composables/useAnalyticsApi";
import type { AnalyticsState } from "../composables/useAnalyticsState";

// props
const props = defineProps<{
  api: AnalyticsApi;
  state: AnalyticsState;
}>();

// local data
const segments = ref<any[]>([]);
const error = ref<string | null>(null);

// local page api
const load = async () => {
  if (!props.state.siteId.value) return;
  try {
    segments.value = (await props.api.get(`site/segments`)).items;
  } catch (err) {
    error.value = errorMessage(err);
  }
};

const apply = (event: Event) => {
  const id = (event.target as HTMLSelectElement).value;
  const segment = segments.value.find((s) => s._id === id);
  if (segment) props.state.filters.value = segment.filters;
  (event.target as HTMLSelectElement).value = "";
};

const save = async () => {
  const name = window.prompt("Segment name");
  if (!name) return;
  try {
    await props.api.post(`site/segments`, { name, filters: props.state.filters.value });
    await load();
  } catch (err) {
    error.value = errorMessage(err);
  }
};

const remove = async (id: string) => {
  if (!window.confirm("Delete this segment?")) return;
  await props.api.del(`site/segments/${encodeURIComponent(id)}`).catch((err) => (error.value = errorMessage(err)));
  await load();
};

// watchers
watch(() => props.state.siteId.value, () => void load(), { immediate: true });
</script>

<template>
  <div class="cfa-row">
    <select v-if="segments.length" class="cfa-select" aria-label="Apply segment" @change="apply">
      <option value="">Segments…</option>
      <option v-for="segment in segments" :key="segment._id" :value="segment._id">{{ segment.name }} ({{ segment.filters.length }})</option>
    </select>
    <button v-if="state.filters.value.length" type="button" class="cfa-btn cfa-btn-sm" @click="save">Save as segment</button>
    <details v-if="segments.length" class="cfa-seg-manage">
      <summary class="cfa-small cfa-muted">Manage</summary>
      <div class="cfa-card cfa-seg-menu">
        <div v-for="segment in segments" :key="segment._id" class="cfa-row" style="justify-content: space-between">
          <span>{{ segment.name }}</span>
          <button type="button" class="cfa-btn cfa-btn-sm cfa-btn-danger" @click="remove(segment._id)">Delete</button>
        </div>
      </div>
    </details>
    <span v-if="error" class="cfa-small" style="color: var(--cfa-bad)">{{ error }}</span>
  </div>
</template>

<style>
.cfa-seg-manage { position: relative; }
.cfa-seg-manage summary { cursor: pointer; }
.cfa-seg-menu { position: absolute; right: 0; top: 24px; z-index: 10; min-width: 240px; display: flex; flex-direction: column; gap: 6px; }
</style>
