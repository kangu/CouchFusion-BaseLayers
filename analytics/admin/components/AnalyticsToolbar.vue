<script setup lang="ts">
/**
 * Website name, date range, compare toggle and active filter chips.
 */
import { RANGE_OPTIONS, type AnalyticsState } from "../composables/useAnalyticsState";
import { DIMENSION_LABELS, formatDimValue } from "../utils/format";

// props
const props = withDefaults(defineProps<{
  state: AnalyticsState;
  showCompare?: boolean;
  showSite?: boolean;
}>(), { showCompare: true, showSite: true });

// local page api
const opLabel = (op: string) => ({ eq: "is", neq: "is not", contains: "contains", not_contains: "does not contain" })[op] ?? op;
const onRange = (event: Event) => {
  props.state.range.value = (event.target as HTMLSelectElement).value;
};
</script>

<template>
  <div class="cfa-toolbar">
    <div class="cfa-row">
      <strong v-if="showSite !== false && state.site.value" class="cfa-site-name">{{ state.site.value.name }}</strong>
      <select class="cfa-select" aria-label="Date range" :value="state.range.value" @change="onRange">
        <option v-for="option in RANGE_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
      </select>
      <template v-if="state.range.value === 'custom'">
        <input v-model="state.from.value" class="cfa-input" type="date" aria-label="From" />
        <span class="cfa-muted">to</span>
        <input v-model="state.to.value" class="cfa-input" type="date" aria-label="To" />
      </template>
      <label v-if="showCompare !== false" class="cfa-check">
        <input v-model="state.compare.value" type="checkbox" /> Compare to previous period
      </label>
    </div>
    <div v-if="state.filters.value.length" class="cfa-row cfa-filters">
      <span class="cfa-muted cfa-small">Filters:</span>
      <span v-for="(filter, index) in state.filters.value" :key="index" class="cfa-chip">
        {{ DIMENSION_LABELS[filter.dim] ?? filter.dim }} {{ opLabel(filter.op) }}
        <strong>{{ formatDimValue(filter.dim, filter.value) }}</strong>
        <button type="button" :aria-label="`Remove filter ${filter.dim}`" @click="state.removeFilter(index)">×</button>
      </span>
      <button type="button" class="cfa-btn cfa-btn-sm" @click="state.clearFilters()">Clear</button>
    </div>
  </div>
</template>

<style>
.cfa-toolbar { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; position: sticky; top: 0; z-index: 5; background: color-mix(in srgb, var(--cfa-page) 92%, transparent); backdrop-filter: blur(6px); padding: 8px 0; }
.cfa-site-name { font-size: 15px; margin-right: 4px; }
</style>
