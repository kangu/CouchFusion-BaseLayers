<script setup lang="ts">
/**
 * Main dashboard body: KPIs, chart, and dimension panels. Shared by the admin
 * overview and the public share page.
 */
import { ref, watch } from "vue";
import type { AnalyticsApi } from "../composables/useAnalyticsApi";
import { errorMessage } from "../composables/useAnalyticsApi";
import type { AnalyticsState } from "../composables/useAnalyticsState";
import KpiCards from "./KpiCards.vue";
import MetricPanel from "./MetricPanel.vue";
import TimeChart from "./TimeChart.vue";
import WorldMap from "./WorldMap.vue";

// props
const props = defineProps<{
  api: AnalyticsApi;
  state: AnalyticsState;
}>();

// local data
const overview = ref<any>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const PANELS = [
  { title: "Pages", tabs: [{ dim: "page", label: "Top pages" }, { dim: "entry", label: "Entry" }, { dim: "exit", label: "Exit" }, { dim: "title", label: "Titles" }, { dim: "host", label: "Hosts" }] },
  { title: "Sources", tabs: [{ dim: "referrer", label: "Referrers" }, { dim: "channel", label: "Channels" }, { dim: "utm_source", label: "UTM source" }, { dim: "utm_medium", label: "Medium" }, { dim: "utm_campaign", label: "Campaign" }, { dim: "utm_term", label: "Term" }, { dim: "utm_content", label: "Content" }] },
  { title: "Location", tabs: [{ dim: "country", label: "Countries" }, { dim: "region", label: "Regions" }, { dim: "city", label: "Cities" }, { dim: "language", label: "Languages" }] },
  { title: "Environment", tabs: [{ dim: "browser", label: "Browsers" }, { dim: "os", label: "OS" }, { dim: "device", label: "Devices" }, { dim: "screen", label: "Screens" }] },
  { title: "Events", tabs: [{ dim: "event", label: "Events" }, { dim: "prop", label: "Properties" }, { dim: "tag", label: "Tags" }] },
];

// local page api
const load = async () => {
  if (!props.state.siteId.value) return;
  loading.value = true;
  error.value = null;
  try {
    overview.value = await props.api.get(`site/overview`, {
      ...props.state.params.value,
      compare: props.state.compare.value ? "1" : undefined,
    });
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    loading.value = false;
  }
};

// watchers
watch(
  () => [props.state.siteId.value, props.state.params.value, props.state.compare.value],
  () => void load(),
  { immediate: true, deep: true },
);
</script>

<template>
  <div>
    <p v-if="error" class="cfa-error">{{ error }}</p>
    <KpiCards :totals="overview?.totals ?? null" :previous="overview?.previous?.totals ?? null" :revenue="overview?.revenue" />
    <section class="cfa-card" style="margin-bottom: 16px" :style="{ opacity: loading ? 0.6 : 1 }">
      <TimeChart
        v-if="overview"
        :series="overview.series"
        :previous="overview.previous?.series ?? null"
        :grain="overview.range.grain"
      />
      <div v-else class="cfa-empty">Loading…</div>
    </section>
    <WorldMap :api="api" :state="state" />
    <div class="cfa-grid cfa-grid-2">
      <MetricPanel v-for="panel in PANELS" :key="panel.title" :api="api" :state="state" :title="panel.title" :tabs="panel.tabs" />
    </div>
  </div>
</template>
