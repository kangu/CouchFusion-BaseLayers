<script setup lang="ts">
/**
 * /admin/analytics/reports — goals, funnels, journeys, retention, UTM,
 * attribution, revenue and breakdown reports, plus saved reports.
 */
import { computed, reactive, ref, watch } from "vue";
import AnalyticsFrame from "../components/AnalyticsFrame.vue";
import AnalyticsToolbar from "../components/AnalyticsToolbar.vue";
import SiteGate from "../components/SiteGate.vue";
import StepEditor from "../components/StepEditor.vue";
import TimeChart from "../components/TimeChart.vue";
import { createAnalyticsApi, errorMessage } from "../composables/useAnalyticsApi";
import { useAnalyticsState } from "../composables/useAnalyticsState";
import { DIMENSION_LABELS, formatDimValue, formatDuration, formatMoney, formatNumber, formatPercent } from "../utils/format";

definePageMeta({ middleware: ["auth", "role-auth"], authAllowedRoles: ["admin", "analytics_viewer"] });
useHead({ title: "Reports · Analytics" });

// composables
const api = createAnalyticsApi("/api/analytics/admin");
const state = useAnalyticsState(api);
const route = useRoute();
const router = useRouter();

// local data
const TYPES = [
  { id: "goals", label: "Goals", help: "Conversion rate of the site's goals (configure them under Settings)." },
  { id: "funnel", label: "Funnel", help: "How many visits complete each step, in order, within a time window." },
  { id: "journey", label: "Journeys", help: "The most common paths through the site." },
  { id: "retention", label: "Retention", help: "How many identified visitors come back on later days (needs identify() or persistent ids)." },
  { id: "utm", label: "UTM", help: "Campaign performance by source / medium / campaign." },
  { id: "attribution", label: "Attribution", help: "Which channels drive a conversion (first or last non-direct touch)." },
  { id: "revenue", label: "Revenue", help: "Revenue from events with revenue + currency properties." },
  { id: "breakdown", label: "Breakdown", help: "Pivot visits across up to three dimensions." },
];
const DIMS = ["channel", "referrer", "utm_source", "utm_medium", "utm_campaign", "country", "region", "city", "language", "browser", "os", "device", "screen", "entry", "exit", "page", "host", "event", "tag"];
const form = reactive<any>({
  funnel: { steps: [{ type: "path", value: "/" }, { type: "path", value: "" }], windowMinutes: 60 },
  journey: { steps: 5, start: { type: "path", value: "" }, end: { type: "path", value: "" } },
  retention: { days: 14 },
  attribution: { goal: { type: "event", value: "" }, model: "last" },
  revenue: { currency: "" },
  breakdown: { dims: ["channel", "device"] },
  goals: { steps: [] as Array<{ type: string; value: string }> },
});
const result = ref<any>(null);
const running = ref(false);
const error = ref<string | null>(null);
const saved = ref<any[]>([]);

// computed
const type = computed<string>({
  get: () => (TYPES.some((t) => t.id === route.query.report) ? String(route.query.report) : "goals"),
  set: (value) => void router.replace({ query: { ...route.query, report: value } }),
});
const currentType = computed(() => TYPES.find((t) => t.id === type.value)!);
const maxCohortLength = computed(() => Math.max(0, ...(result.value?.cohorts ?? []).map((c: any) => c.retention.length)));

// local page api
const body = () => {
  const params: any = { ...state.params.value };
  const f = form[type.value];
  if (type.value === "goals" && f.steps.some((s: any) => s.value)) params.goals = f.steps.filter((s: any) => s.value);
  if (type.value === "funnel") Object.assign(params, { steps: f.steps, windowMinutes: f.windowMinutes });
  if (type.value === "journey") Object.assign(params, { steps: f.steps, start: f.start.value ? f.start : null, end: f.end.value ? f.end : null });
  if (type.value === "retention") params.days = f.days;
  if (type.value === "attribution") Object.assign(params, { goal: f.goal, model: f.model });
  if (type.value === "revenue") params.currency = f.currency;
  if (type.value === "breakdown") params.dims = f.dims.filter(Boolean);
  return params;
};

const run = async () => {
  if (!state.siteId.value) return;
  running.value = true;
  error.value = null;
  try {
    result.value = await api.post(`site/reports/${type.value}`, body());
  } catch (err) {
    error.value = errorMessage(err);
    result.value = null;
  } finally {
    running.value = false;
  }
};

const loadSaved = async () => {
  if (!state.siteId.value) return;
  saved.value = (await api.get(`site/reports`).catch(() => ({ items: [] }))).items;
};

const saveReport = async () => {
  const name = window.prompt("Report name");
  if (!name) return;
  try {
    await api.post(`site/reports`, { name, reportType: type.value, params: JSON.parse(JSON.stringify(form[type.value])) });
    await loadSaved();
  } catch (err) {
    error.value = errorMessage(err);
  }
};

const openSaved = async (item: any) => {
  form[item.reportType] = { ...form[item.reportType], ...item.params };
  type.value = item.reportType;
  setTimeout(() => void run(), 0);
};

const deleteSaved = async (item: any) => {
  if (!window.confirm(`Delete “${item.name}”?`)) return;
  await api.del(`site/reports/${encodeURIComponent(item._id)}`).catch(() => undefined);
  await loadSaved();
};

// watchers
watch(() => [type.value, state.siteId.value, state.params.value], () => {
  result.value = null;
  if (["goals", "utm", "revenue", "retention"].includes(type.value)) void run();
}, { immediate: true, deep: true });
watch(() => state.siteId.value, () => void loadSaved(), { immediate: true });
</script>

<template>
  <AnalyticsFrame title="Reports" subtitle="Computed on demand from raw events">
    <SiteGate :state="state">
      <AnalyticsToolbar :state="state" :show-compare="false" />
      <div class="cfa-reports">
        <aside class="cfa-card cfa-report-nav">
          <button v-for="t in TYPES" :key="t.id" type="button" class="cfa-site-item" :aria-current="t.id === type" @click="type = t.id">
            <strong>{{ t.label }}</strong>
          </button>
          <template v-if="saved.length">
            <h3 style="margin-top: 12px">Saved</h3>
            <div v-for="item in saved" :key="item._id" class="cfa-row" style="justify-content: space-between">
              <button type="button" class="cfa-btn cfa-btn-sm" @click="openSaved(item)">{{ item.name }}</button>
              <button type="button" class="cfa-btn cfa-btn-sm" aria-label="Delete saved report" @click="deleteSaved(item)">×</button>
            </div>
          </template>
        </aside>

        <div class="cfa-stack">
          <form class="cfa-card cfa-stack" @submit.prevent="run">
            <div>
              <h2 style="margin-bottom: 2px">{{ currentType.label }}</h2>
              <p class="cfa-small cfa-muted" style="margin: 0">{{ currentType.help }}</p>
            </div>
            <template v-if="type === 'goals'">
              <p class="cfa-small cfa-muted" style="margin: 0">Uses the site's saved goals; add ad-hoc goals below to override.</p>
              <StepEditor v-model="form.goals.steps" :min="0" :max="20" label="Goal" />
            </template>
            <template v-else-if="type === 'funnel'">
              <StepEditor v-model="form.funnel.steps" :min="2" />
              <label class="cfa-field" style="max-width: 220px"><span>Window (minutes)</span><input v-model.number="form.funnel.windowMinutes" class="cfa-input" type="number" min="1" max="1440" /></label>
            </template>
            <template v-else-if="type === 'journey'">
              <div class="cfa-row">
                <label class="cfa-field"><span>Steps</span><input v-model.number="form.journey.steps" class="cfa-input" type="number" min="2" max="7" /></label>
                <label class="cfa-field"><span>Starts with (optional)</span><input v-model="form.journey.start.value" class="cfa-input" placeholder="/pricing" /></label>
                <label class="cfa-field"><span>Ends with (optional)</span><input v-model="form.journey.end.value" class="cfa-input" placeholder="/contact" /></label>
              </div>
            </template>
            <template v-else-if="type === 'retention'">
              <label class="cfa-field" style="max-width: 220px"><span>Days to follow</span><input v-model.number="form.retention.days" class="cfa-input" type="number" min="1" max="31" /></label>
            </template>
            <template v-else-if="type === 'attribution'">
              <div class="cfa-row">
                <select v-model="form.attribution.goal.type" class="cfa-select"><option value="event">Event</option><option value="path">Page</option></select>
                <input v-model="form.attribution.goal.value" class="cfa-input" placeholder="Conversion, e.g. signup" required />
                <select v-model="form.attribution.model" class="cfa-select"><option value="last">Last touch</option><option value="first">First touch</option></select>
              </div>
            </template>
            <template v-else-if="type === 'revenue'">
              <label class="cfa-field" style="max-width: 220px"><span>Currency (optional)</span><input v-model="form.revenue.currency" class="cfa-input" placeholder="EUR" maxlength="3" /></label>
            </template>
            <template v-else-if="type === 'breakdown'">
              <div class="cfa-row">
                <select v-for="i in 3" :key="i" v-model="form.breakdown.dims[i - 1]" class="cfa-select">
                  <option :value="undefined">—</option>
                  <option v-for="dim in DIMS" :key="dim" :value="dim">{{ DIMENSION_LABELS[dim] }}</option>
                </select>
              </div>
            </template>
            <div class="cfa-row">
              <button type="submit" class="cfa-btn cfa-btn-primary" :disabled="running">{{ running ? "Running…" : "Run report" }}</button>
              <button type="button" class="cfa-btn" @click="saveReport">Save report</button>
            </div>
          </form>

          <p v-if="error" class="cfa-error">{{ error }}</p>

          <section v-if="result" class="cfa-card cfa-scroll-x">
            <!-- goals -->
            <template v-if="type === 'goals'">
              <div v-if="!result.goals.length" class="cfa-empty">No goals configured. Add goals under Settings, or above.</div>
              <table v-else class="cfa-table">
                <thead><tr><th>Goal</th><th class="cfa-num">Visitors</th><th class="cfa-num">Count</th><th class="cfa-num">Conversion</th></tr></thead>
                <tbody><tr v-for="goal in result.goals" :key="goal.id">
                  <td>{{ goal.name }} <span class="cfa-badge">{{ goal.type === "event" ? "event" : "page" }}: {{ goal.value }}</span></td>
                  <td class="cfa-num">{{ formatNumber(goal.visitors) }}</td><td class="cfa-num">{{ formatNumber(goal.count) }}</td>
                  <td class="cfa-num"><div class="cfa-bar-cell"><span :style="{ width: `${goal.conversionRate}%` }" /></div>{{ formatPercent(goal.conversionRate) }}</td>
                </tr></tbody>
              </table>
              <p class="cfa-small cfa-muted">Out of {{ formatNumber(result.totalVisitors) }} visitors.</p>
            </template>
            <!-- funnel -->
            <template v-else-if="type === 'funnel'">
              <div class="cfa-funnel">
                <div v-for="(step, index) in result.steps" :key="index" class="cfa-funnel-step">
                  <div class="cfa-small cfa-muted">Step {{ index + 1 }} · {{ step.type === "event" ? "⚡" : "" }}{{ step.value }}</div>
                  <div class="cfa-funnel-bar"><span :style="{ width: `${Math.max(1, step.conversionRate)}%` }" /></div>
                  <div class="cfa-row cfa-small"><strong>{{ formatNumber(step.visitors) }} visitors</strong> <span>{{ formatPercent(step.conversionRate) }} of start</span>
                    <span v-if="index > 0" class="cfa-muted">−{{ formatNumber(step.dropoff) }} ({{ formatPercent(step.dropoffRate) }} drop-off)</span></div>
                </div>
              </div>
            </template>
            <!-- journey -->
            <template v-else-if="type === 'journey'">
              <div v-if="!result.journeys.length" class="cfa-empty">No matching journeys</div>
              <table v-else class="cfa-table">
                <thead><tr><th>Path</th><th class="cfa-num">Visits</th><th class="cfa-num">%</th></tr></thead>
                <tbody><tr v-for="(row, index) in result.journeys" :key="index">
                  <td><span v-for="(step, i) in row.path" :key="i" class="cfa-journey-step">{{ step }}</span></td>
                  <td class="cfa-num">{{ formatNumber(row.visits) }}</td>
                  <td class="cfa-num cfa-muted">{{ result.totalVisits ? Math.round((row.visits / result.totalVisits) * 1000) / 10 : 0 }}%</td>
                </tr></tbody>
              </table>
            </template>
            <!-- retention -->
            <template v-else-if="type === 'retention'">
              <p v-if="result.note" class="cfa-muted">{{ result.note }}</p>
              <p class="cfa-small cfa-muted">{{ result.identifiedVisitors }} identified visitors · {{ result.anonymousVisits }} anonymous visits excluded</p>
              <table v-if="result.cohorts.length" class="cfa-table cfa-retention">
                <thead><tr><th>Cohort</th><th class="cfa-num">Size</th><th v-for="i in maxCohortLength" :key="i" class="cfa-num">D{{ i - 1 }}</th></tr></thead>
                <tbody><tr v-for="cohort in result.cohorts" :key="cohort.day">
                  <td>{{ cohort.day }}</td><td class="cfa-num">{{ cohort.size }}</td>
                  <td v-for="(value, i) in cohort.retention" :key="i" class="cfa-num" :style="value === null ? {} : { background: `color-mix(in srgb, var(--cfa-accent) ${Math.round(value * 0.6)}%, transparent)` }">{{ value === null ? "" : `${value}%` }}</td>
                </tr></tbody>
              </table>
            </template>
            <!-- utm / breakdown -->
            <template v-else-if="type === 'utm' || type === 'breakdown'">
              <div v-if="!result.rows.length" class="cfa-empty">No data</div>
              <table v-else class="cfa-table">
                <thead><tr>
                  <th v-for="h in type === 'utm' ? ['Source', 'Medium', 'Campaign', 'Term', 'Content'] : result.dims.map((d: string) => DIMENSION_LABELS[d] ?? d)" :key="h">{{ h }}</th>
                  <th class="cfa-num">Visitors</th><th class="cfa-num">Visits</th><th class="cfa-num">Views</th><th class="cfa-num">Events</th><th class="cfa-num">Bounce</th><th class="cfa-num">Duration</th>
                </tr></thead>
                <tbody><tr v-for="(row, index) in result.rows" :key="index">
                  <td v-for="(k, i) in row.key" :key="i">{{ type === "breakdown" ? formatDimValue(result.dims[i], k) : k }}</td>
                  <td class="cfa-num">{{ formatNumber(row.visitors) }}</td><td class="cfa-num">{{ formatNumber(row.visits) }}</td><td class="cfa-num">{{ formatNumber(row.pageviews) }}</td>
                  <td class="cfa-num">{{ formatNumber(row.events) }}</td><td class="cfa-num">{{ formatPercent(row.bounceRate) }}</td><td class="cfa-num">{{ formatDuration(row.avgDuration) }}</td>
                </tr></tbody>
              </table>
            </template>
            <!-- attribution -->
            <template v-else-if="type === 'attribution'">
              <p><strong>{{ formatNumber(result.conversions) }}</strong> conversions · {{ result.model === "first" ? "first" : "last" }} non-direct touch</p>
              <div class="cfa-grid cfa-grid-2">
                <div v-for="dim in ['channel', 'referrer', 'utm_source', 'utm_campaign']" :key="dim">
                  <h3>{{ DIMENSION_LABELS[dim] }}</h3>
                  <table class="cfa-table"><tr v-for="row in result[dim]" :key="row.value">
                    <td>{{ formatDimValue(dim, row.value) }}</td><td class="cfa-num">{{ row.conversions }}</td><td class="cfa-num cfa-muted">{{ row.share }}%</td>
                    <td v-if="dim === 'channel' && row.revenue" class="cfa-num">{{ formatNumber(row.revenue) }}</td>
                  </tr></table>
                </div>
              </div>
            </template>
            <!-- revenue -->
            <template v-else-if="type === 'revenue'">
              <div v-if="!result.totals.length" class="cfa-empty">No revenue events. Send events with <code>revenue</code> and <code>currency</code> properties.</div>
              <template v-else>
                <div class="cfa-kpis">
                  <div v-for="t in result.totals" :key="t.currency" class="cfa-kpi">
                    <div class="cfa-kpi-label">{{ t.currency }} · {{ t.count }} orders · avg {{ formatMoney(t.average, t.currency) }}</div>
                    <div class="cfa-kpi-value">{{ formatMoney(t.amount, t.currency) }}</div>
                  </div>
                </div>
                <TimeChart :series="result.series.map((p: any) => ({ t: p.t, pageviews: p.amount, visitors: p.amount }))" grain="day" :height="200" bars />
                <div class="cfa-grid cfa-grid-2" style="margin-top: 12px">
                  <div v-for="block in [{ key: 'byEvent', dim: 'event', title: 'By event' }, { key: 'byChannel', dim: 'channel', title: 'By channel' }, { key: 'byCountry', dim: 'country', title: 'By country' }, { key: 'byReferrer', dim: 'referrer', title: 'By referrer' }]" :key="block.key">
                    <h3>{{ block.title }}</h3>
                    <table class="cfa-table"><tr v-for="row in result[block.key]" :key="row.value"><td>{{ formatDimValue(block.dim, row.value) }}</td><td class="cfa-num">{{ formatMoney(row.amount, result.currency) }}</td></tr></table>
                  </div>
                </div>
              </template>
            </template>
          </section>
        </div>
      </div>
    </SiteGate>
  </AnalyticsFrame>
</template>

<style>
.cfa-reports { display: grid; grid-template-columns: minmax(0, 200px) minmax(0, 1fr); gap: 16px; align-items: start; }
@media (max-width: 860px) { .cfa-reports { grid-template-columns: minmax(0, 1fr); } }
.cfa-report-nav { display: flex; flex-direction: column; gap: 2px; }
.cfa-funnel { display: flex; flex-direction: column; gap: 14px; }
.cfa-funnel-bar, .cfa-bar-cell { background: var(--cfa-surface-2); border-radius: 6px; height: 26px; overflow: hidden; margin: 4px 0; }
.cfa-bar-cell { height: 6px; width: 80px; display: inline-block; margin-right: 8px; vertical-align: middle; }
.cfa-funnel-bar span, .cfa-bar-cell span { display: block; height: 100%; background: var(--cfa-accent); }
.cfa-journey-step { display: inline-block; background: var(--cfa-surface-2); border-radius: 6px; padding: 1px 8px; margin: 2px 0; font-size: 12.5px; }
.cfa-journey-step + .cfa-journey-step::before { content: "→ "; color: var(--cfa-muted); }
.cfa-retention td { min-width: 52px; }
</style>
