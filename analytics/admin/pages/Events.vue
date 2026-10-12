<script setup lang="ts">
/**
 * /admin/analytics/events — custom events, their trend and property breakdown.
 */
import { computed, ref, watch } from "vue";
import AnalyticsFrame from "../components/AnalyticsFrame.vue";
import AnalyticsToolbar from "../components/AnalyticsToolbar.vue";
import SiteGate from "../components/SiteGate.vue";
import TimeChart from "../components/TimeChart.vue";
import { createAnalyticsApi, errorMessage } from "../composables/useAnalyticsApi";
import { useAnalyticsState } from "../composables/useAnalyticsState";
import { formatNumber } from "../utils/format";

definePageMeta({ middleware: ["auth", "role-auth"], authAllowedRoles: ["admin", "analytics_viewer"] });
useHead({ title: "Events · Analytics" });

// composables
const api = createAnalyticsApi("/api/analytics/admin");
const state = useAnalyticsState(api);

// local data
const events = ref<any[]>([]);
const selected = ref<string>("");
const trend = ref<any>(null);
const props = ref<any[]>([]);
const error = ref<string | null>(null);
const loading = ref(false);

// computed
const groupedProps = computed(() => {
  const groups = new Map<string, Array<{ value: string; c: number; v: number }>>();
  for (const row of props.value) {
    const [, key, value] = String(row.value).split("\u001f");
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push({ value, c: row.c ?? 0, v: row.v ?? 0 });
    groups.set(key, list);
  }
  return [...groups].map(([key, rows]) => ({ key, rows: rows.slice(0, 15), total: rows.reduce((sum, r) => sum + r.c, 0) }));
});
const eventFilters = computed(() =>
  JSON.stringify([...state.filters.value.filter((f) => f.dim !== "event"), { dim: "event", op: "eq", value: selected.value }]),
);

// local page api
const loadEvents = async () => {
  if (!state.siteId.value) return;
  loading.value = true;
  error.value = null;
  try {
    const result = await api.get(`site/metrics/event`, { ...state.params.value, limit: 200 });
    events.value = result.rows;
    if (!events.value.some((e) => e.value === selected.value)) selected.value = events.value[0]?.value ?? "";
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    loading.value = false;
  }
};

const loadSelected = async () => {
  if (!selected.value || !state.siteId.value) {
    trend.value = null;
    props.value = [];
    return;
  }
  try {
    const [overview, propRows] = await Promise.all([
      api.get(`site/overview`, { ...state.params.value, filters: eventFilters.value }),
      api.get(`site/metrics/prop`, { ...state.params.value, event: selected.value, limit: 500 }),
    ]);
    trend.value = overview;
    props.value = propRows.rows;
  } catch (err) {
    error.value = errorMessage(err);
  }
};

// watchers
watch(() => [state.siteId.value, state.params.value], () => void loadEvents(), { immediate: true, deep: true });
watch(() => [selected.value, state.params.value], () => void loadSelected(), { deep: true });
</script>

<template>
  <AnalyticsFrame title="Events" subtitle="Custom events sent with track() or v-analytics">
    <SiteGate :state="state">
      <AnalyticsToolbar :state="state" :show-compare="false" />
      <p v-if="error" class="cfa-error">{{ error }}</p>
      <div class="cfa-events">
        <section class="cfa-card">
          <h2>Events</h2>
          <div v-if="!events.length" class="cfa-empty">{{ loading ? "Loading…" : "No events in this period" }}</div>
          <table v-else class="cfa-table">
            <thead><tr><th>Name</th><th class="cfa-num">Visitors</th><th class="cfa-num">Count</th></tr></thead>
            <tbody>
              <tr v-for="row in events" :key="row.value" class="cfa-event-row" :class="{ active: row.value === selected }" @click="selected = row.value">
                <td class="cfa-truncate">{{ row.value }}</td>
                <td class="cfa-num">{{ formatNumber(row.v) }}</td>
                <td class="cfa-num">{{ formatNumber(row.c) }}</td>
              </tr>
            </tbody>
          </table>
        </section>
        <div v-if="selected" class="cfa-stack">
          <section class="cfa-card">
            <h2>{{ selected }}</h2>
            <p class="cfa-muted cfa-small">
              {{ formatNumber(trend?.totals?.events) }} events from {{ formatNumber(trend?.totals?.visitors) }} visitors in this period.
            </p>
            <TimeChart v-if="trend" :series="trend.series" :grain="trend.range.grain" :height="220" bars />
          </section>
          <section class="cfa-card">
            <h2>Properties</h2>
            <div v-if="!groupedProps.length" class="cfa-empty">This event has no properties</div>
            <div class="cfa-grid cfa-grid-2">
              <div v-for="group in groupedProps" :key="group.key">
                <h3>{{ group.key }}</h3>
                <table class="cfa-table">
                  <tr v-for="row in group.rows" :key="row.value">
                    <td class="cfa-truncate">{{ row.value }}</td>
                    <td class="cfa-num">{{ formatNumber(row.c) }}</td>
                    <td class="cfa-num cfa-muted">{{ group.total ? Math.round((row.c / group.total) * 100) : 0 }}%</td>
                  </tr>
                </table>
              </div>
            </div>
          </section>
        </div>
      </div>
    </SiteGate>
  </AnalyticsFrame>
</template>

<style>
.cfa-events { display: grid; grid-template-columns: minmax(0, 340px) minmax(0, 1fr); gap: 16px; align-items: start; }
@media (max-width: 860px) { .cfa-events { grid-template-columns: minmax(0, 1fr); } }
.cfa-event-row { cursor: pointer; }
.cfa-event-row:hover td, .cfa-event-row.active td { background: var(--cfa-accent-soft); }
</style>
