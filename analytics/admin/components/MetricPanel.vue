<script setup lang="ts">
/**
 * Tabbed top-N table for one or more dimensions. Clicking a row adds a filter.
 */
import { computed, ref, watch } from "vue";
import type { AnalyticsApi } from "../composables/useAnalyticsApi";
import { errorMessage } from "../composables/useAnalyticsApi";
import type { AnalyticsState } from "../composables/useAnalyticsState";
import { DIMENSION_LABELS, formatDimValue, formatDuration, formatNumber, formatPercent } from "../utils/format";

// props
const props = withDefaults(defineProps<{
  api: AnalyticsApi;
  state: AnalyticsState;
  title: string;
  tabs: Array<{ dim: string; label?: string }>;
  limit?: number;
  extraQuery?: Record<string, any>;
  clickable?: boolean;
}>(), { clickable: true, limit: 8, extraQuery: undefined });

// local data
const active = ref(props.tabs[0]?.dim ?? "page");
const rows = ref<any[]>([]);
const total = ref(0);
const totals = ref<any>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const expanded = ref(false);
const search = ref("");

// computed
const isEventDim = computed(() => active.value === "event" || active.value === "prop");
const isPageDim = computed(() => ["page", "title", "host"].includes(active.value));
const primary = computed(() => (isEventDim.value ? "c" : "v"));
const max = computed(() => Math.max(1, ...rows.value.map((row) => row[primary.value] ?? 0)));
const exportUrl = computed(() =>
  props.api.readonly ? null : props.api.url(`site/export`, { ...props.state.params.value, dim: active.value }),
);

// local page api
const load = async () => {
  if (!props.state.siteId.value) return;
  loading.value = true;
  error.value = null;
  try {
    const result = await props.api.get(`site/metrics/${active.value}`, {
      ...props.state.params.value,
      ...props.extraQuery,
      limit: expanded.value ? 100 : props.limit ?? 8,
      search: expanded.value ? search.value : undefined,
    });
    rows.value = result.rows;
    total.value = result.total;
    totals.value = result.totals;
  } catch (err) {
    error.value = errorMessage(err);
    rows.value = [];
  } finally {
    loading.value = false;
  }
};

const select = (row: any) => {
  if (props.clickable === false || row.value === "(other)") return;
  if (active.value === "prop") {
    const [event, key, value] = String(row.value).split("\u001f");
    props.state.addFilter({ dim: "event", op: "eq", value: event });
    props.state.addFilter({ dim: "prop", op: "eq", value: `${key}=${value}` });
    return;
  }
  props.state.addFilter({ dim: active.value, op: "eq", value: row.value });
};

const share = (row: any) => {
  const base = isEventDim.value ? totals.value?.events : isPageDim.value ? totals.value?.pageviews : totals.value?.visits;
  const value = isEventDim.value ? row.c : isPageDim.value ? row.pv : row.vi;
  return base ? `${Math.round(((value ?? 0) / base) * 1000) / 10}%` : "";
};

// watchers
watch(
  () => [props.state.siteId.value, props.state.params.value, active.value, expanded.value, props.extraQuery],
  () => void load(),
  { immediate: true, deep: true },
);
let searchTimer: ReturnType<typeof setTimeout> | null = null;
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => void load(), 250);
});
</script>

<template>
  <section class="cfa-card cfa-metric">
    <div class="cfa-metric-head">
      <h2>{{ title }}</h2>
      <a v-if="exportUrl && rows.length" class="cfa-small cfa-muted" :href="exportUrl">CSV</a>
    </div>
    <div v-if="tabs.length > 1" class="cfa-tabs" role="tablist">
      <button
        v-for="tab in tabs"
        :key="tab.dim"
        type="button"
        role="tab"
        class="cfa-tab"
        :aria-selected="active === tab.dim"
        @click="active = tab.dim"
      >
        {{ tab.label ?? DIMENSION_LABELS[tab.dim] ?? tab.dim }}
      </button>
    </div>
    <input v-if="expanded" v-model="search" class="cfa-input cfa-metric-search" type="search" placeholder="Search…" />
    <p v-if="error" class="cfa-error">{{ error }}</p>
    <div v-else-if="!rows.length" class="cfa-empty">{{ loading ? "Loading…" : "No data for this period" }}</div>
    <table v-else class="cfa-table cfa-metric-table" :class="{ 'is-loading': loading }">
      <thead>
        <tr>
          <th>{{ tabs.find((t) => t.dim === active)?.label ?? DIMENSION_LABELS[active] ?? active }}</th>
          <th class="cfa-num">Visitors</th>
          <th class="cfa-num">{{ isEventDim ? "Count" : isPageDim ? "Views" : "Visits" }}</th>
          <th v-if="!isEventDim && !isPageDim && expanded" class="cfa-num">Bounce</th>
          <th v-if="!isEventDim && !isPageDim && expanded" class="cfa-num">Duration</th>
          <th class="cfa-num cfa-share">%</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.value" :class="{ clickable: clickable !== false && row.value !== '(other)' }" @click="select(row)">
          <td class="cfa-metric-label">
            <span class="cfa-metric-bar" :style="{ width: `${Math.max(2, ((row[primary] ?? 0) / max) * 100)}%` }" />
            <span class="cfa-truncate" :title="row.value">{{ formatDimValue(active, row.value) }}</span>
          </td>
          <td class="cfa-num">{{ formatNumber(row.v) }}</td>
          <td class="cfa-num">{{ formatNumber(isEventDim ? row.c : isPageDim ? row.pv : row.vi) }}</td>
          <td v-if="!isEventDim && !isPageDim && expanded" class="cfa-num">{{ formatPercent(row.bounceRate) }}</td>
          <td v-if="!isEventDim && !isPageDim && expanded" class="cfa-num">{{ formatDuration(row.avgDuration) }}</td>
          <td class="cfa-num cfa-share cfa-muted">{{ share(row) }}</td>
        </tr>
      </tbody>
    </table>
    <button v-if="total > rows.length || expanded" type="button" class="cfa-btn cfa-btn-sm cfa-metric-more" @click="expanded = !expanded">
      {{ expanded ? "Show less" : `Show all (${total})` }}
    </button>
  </section>
</template>

<style>
.cfa-metric-head { display: flex; justify-content: space-between; align-items: baseline; }
.cfa-metric-table { table-layout: fixed; }
.cfa-metric-table th:first-child { width: auto; }
.cfa-metric-table th.cfa-num { width: 74px; }
.cfa-metric-table.is-loading { opacity: 0.6; }
.cfa-metric-table tr.clickable { cursor: pointer; }
.cfa-metric-table tr.clickable:hover td { background: var(--cfa-surface-2); }
.cfa-metric-label { position: relative; }
.cfa-metric-label .cfa-truncate { position: relative; display: block; }
.cfa-metric-bar { position: absolute; left: 0; top: 3px; bottom: 3px; background: var(--cfa-bar); border-radius: 4px; }
.cfa-metric-more { margin-top: 8px; }
.cfa-metric-search { width: 100%; margin-bottom: 8px; }
@media (max-width: 520px) { .cfa-share { display: none; } }
</style>
