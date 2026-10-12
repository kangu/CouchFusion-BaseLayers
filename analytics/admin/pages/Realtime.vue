<script setup lang="ts">
/**
 * /admin/analytics/realtime — last 30 minutes, refreshed every 10 seconds.
 */
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import AnalyticsFrame from "../components/AnalyticsFrame.vue";
import AnalyticsToolbar from "../components/AnalyticsToolbar.vue";
import SiteGate from "../components/SiteGate.vue";
import TimeChart from "../components/TimeChart.vue";
import { createAnalyticsApi, errorMessage } from "../composables/useAnalyticsApi";
import { useAnalyticsState } from "../composables/useAnalyticsState";
import { formatDimValue, formatNumber } from "../utils/format";

definePageMeta({ middleware: ["auth", "role-auth"], authAllowedRoles: ["admin", "analytics_viewer"] });
useHead({ title: "Realtime · Analytics" });

// composables
const api = createAnalyticsApi("/api/analytics/admin");
const state = useAnalyticsState(api);

// local data
const data = ref<any>(null);
const error = ref<string | null>(null);
let timer: ReturnType<typeof setInterval> | null = null;

// local page api
const load = async () => {
  if (!state.siteId.value) return;
  try {
    data.value = await api.get(`site/realtime`);
    error.value = null;
  } catch (err) {
    error.value = errorMessage(err);
  }
};

// lifecycle
onMounted(() => {
  timer = setInterval(() => {
    if (document.visibilityState === "visible") void load();
  }, 10_000);
});
onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});

// watchers
watch(() => state.siteId.value, () => void load(), { immediate: true });
</script>

<template>
  <AnalyticsFrame title="Realtime" subtitle="Activity in the last 30 minutes · refreshes every 10 s">
    <SiteGate :state="state">
      <AnalyticsToolbar :state="state" :show-compare="false" />
      <p v-if="error" class="cfa-error">{{ error }}</p>
      <template v-if="data">
        <div class="cfa-kpis">
          <div class="cfa-kpi"><div class="cfa-kpi-label">Active now (5 min)</div><div class="cfa-kpi-value"><span class="cfa-live" />{{ data.activeVisitors }}</div></div>
          <div class="cfa-kpi"><div class="cfa-kpi-label">Visitors (30 min)</div><div class="cfa-kpi-value">{{ formatNumber(data.visitors) }}</div></div>
          <div class="cfa-kpi"><div class="cfa-kpi-label">Pageviews</div><div class="cfa-kpi-value">{{ formatNumber(data.pageviews) }}</div></div>
          <div class="cfa-kpi"><div class="cfa-kpi-label">Events</div><div class="cfa-kpi-value">{{ formatNumber(data.events) }}</div></div>
        </div>
        <section class="cfa-card" style="margin-bottom: 16px">
          <TimeChart :series="data.series" grain="minute" :height="200" bars />
        </section>
        <div class="cfa-grid cfa-grid-3" style="margin-bottom: 16px">
          <section v-for="block in [{ key: 'pages', title: 'Active pages', dim: 'page' }, { key: 'referrers', title: 'Referrers', dim: 'referrer' }, { key: 'countries', title: 'Countries', dim: 'country' }]" :key="block.key" class="cfa-card">
            <h2>{{ block.title }}</h2>
            <div v-if="!data[block.key].length" class="cfa-empty">Nobody here right now</div>
            <table v-else class="cfa-table">
              <tr v-for="row in data[block.key]" :key="row.value">
                <td class="cfa-truncate">{{ formatDimValue(block.dim, row.value) }}</td>
                <td class="cfa-num">{{ row.v }}</td>
              </tr>
            </table>
          </section>
        </div>
        <section class="cfa-card cfa-scroll-x">
          <h2>Latest activity</h2>
          <div v-if="!data.recent.length" class="cfa-empty">No activity in the last 30 minutes</div>
          <table v-else class="cfa-table">
            <thead><tr><th>Time</th><th>Type</th><th>Page / event</th><th>Country</th><th>Device</th><th>Referrer</th></tr></thead>
            <tbody>
              <tr v-for="(row, index) in data.recent" :key="index">
                <td class="cfa-num">{{ new Date(row.ts).toLocaleTimeString() }}</td>
                <td><span class="cfa-badge">{{ row.type === "pv" ? "view" : "event" }}</span></td>
                <td class="cfa-truncate">{{ row.type === "pv" ? row.path : `${row.name} · ${row.path}` }}</td>
                <td>{{ row.country ? formatDimValue("country", row.country) : "—" }}</td>
                <td>{{ row.browser }} · {{ row.device }}</td>
                <td>{{ row.referrer ?? "—" }}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </template>
    </SiteGate>
  </AnalyticsFrame>
</template>

<style>
.cfa-live { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: var(--cfa-good); margin-right: 8px; vertical-align: middle; animation: cfa-pulse 1.6s infinite; }
@keyframes cfa-pulse { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--cfa-good) 60%, transparent); } 70% { box-shadow: 0 0 0 8px transparent; } 100% { box-shadow: 0 0 0 0 transparent; } }
@media (prefers-reduced-motion: reduce) { .cfa-live { animation: none; } }
</style>
