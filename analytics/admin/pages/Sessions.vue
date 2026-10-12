<script setup lang="ts">
/**
 * /admin/analytics/sessions — visit explorer with per-visit event timelines.
 */
import { ref, watch } from "vue";
import AnalyticsFrame from "../components/AnalyticsFrame.vue";
import AnalyticsToolbar from "../components/AnalyticsToolbar.vue";
import SiteGate from "../components/SiteGate.vue";
import { createAnalyticsApi, errorMessage } from "../composables/useAnalyticsApi";
import { useAnalyticsState } from "../composables/useAnalyticsState";
import { formatDimValue, formatDuration } from "../utils/format";

definePageMeta({ middleware: ["auth", "role-auth"], authAllowedRoles: ["admin", "analytics_viewer"] });
useHead({ title: "Sessions · Analytics" });

// composables
const api = createAnalyticsApi("/api/analytics/admin");
const state = useAnalyticsState(api);

// local data
const PAGE = 50;
const sessions = ref<any[]>([]);
const total = ref(0);
const offset = ref(0);
const detail = ref<any>(null);
const error = ref<string | null>(null);
const loading = ref(false);

// local page api
const load = async () => {
  if (!state.siteId.value) return;
  loading.value = true;
  error.value = null;
  try {
    const result = await api.get(`site/sessions`, { ...state.params.value, offset: offset.value, limit: PAGE });
    sessions.value = result.sessions;
    total.value = result.total;
  } catch (err) {
    error.value = errorMessage(err);
    sessions.value = [];
  } finally {
    loading.value = false;
  }
};

const open = async (id: string) => {
  try {
    detail.value = await api.get(`site/sessions/${encodeURIComponent(id)}`);
  } catch (err) {
    error.value = errorMessage(err);
  }
};

const time = (ts: number) => new Date(ts).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

// watchers
watch(() => [state.siteId.value, state.params.value], () => {
  offset.value = 0;
  void load();
}, { immediate: true, deep: true });
watch(offset, () => void load());
</script>

<template>
  <AnalyticsFrame title="Sessions" subtitle="Individual visits and what happened in them">
    <SiteGate :state="state">
      <AnalyticsToolbar :state="state" :show-compare="false" />
      <p v-if="error" class="cfa-error">{{ error }}</p>
      <div class="cfa-sessions" :class="{ 'has-detail': detail }">
        <section class="cfa-card cfa-scroll-x">
          <div v-if="!sessions.length" class="cfa-empty">{{ loading ? "Loading…" : "No sessions in this period" }}</div>
          <table v-else class="cfa-table">
            <thead>
              <tr><th>Started</th><th>Visitor</th><th>Entry</th><th class="cfa-num">Views</th><th class="cfa-num">Events</th><th class="cfa-num">Duration</th><th>Source</th><th>Location</th><th>Device</th></tr>
            </thead>
            <tbody>
              <tr v-for="s in sessions" :key="s.id" class="cfa-session-row" :class="{ active: detail?.id === s.id }" @click="open(s.id)">
                <td class="cfa-num">{{ time(s.start) }}</td>
                <td><code class="cfa-small">{{ s.identity ? s.identity.slice(2) : s.visitor.slice(0, 8) }}</code></td>
                <td class="cfa-truncate" style="max-width: 200px">{{ s.entry ?? "—" }}</td>
                <td class="cfa-num">{{ s.pageviews }}</td>
                <td class="cfa-num">{{ s.events }}</td>
                <td class="cfa-num">{{ s.bounce ? "bounce" : formatDuration(s.duration) }}</td>
                <td>{{ s.referrer ?? formatDimValue("channel", s.channel) }}</td>
                <td>{{ s.country ? formatDimValue("country", s.country) : "—" }}{{ s.city ? `, ${s.city}` : "" }}</td>
                <td class="cfa-small">{{ s.browser }} · {{ s.os }} · {{ s.device }}</td>
              </tr>
            </tbody>
          </table>
          <div v-if="total > PAGE" class="cfa-row" style="margin-top: 10px">
            <button type="button" class="cfa-btn cfa-btn-sm" :disabled="offset === 0" @click="offset = Math.max(0, offset - PAGE)">← Newer</button>
            <span class="cfa-small cfa-muted">{{ offset + 1 }}–{{ Math.min(offset + PAGE, total) }} of {{ total }}</span>
            <button type="button" class="cfa-btn cfa-btn-sm" :disabled="offset + PAGE >= total" @click="offset += PAGE">Older →</button>
          </div>
        </section>
        <aside v-if="detail" class="cfa-card cfa-session-detail">
          <div class="cfa-row" style="justify-content: space-between">
            <h2 style="margin: 0">Session</h2>
            <button type="button" class="cfa-btn cfa-btn-sm" aria-label="Close" @click="detail = null">×</button>
          </div>
          <p class="cfa-small cfa-muted">
            {{ time(detail.start) }} · {{ formatDuration(detail.duration) }} · {{ detail.browser }} on {{ detail.os }} ({{ detail.device }}{{ detail.screen ? `, ${detail.screen}` : "" }})
            <br />{{ detail.country ? formatDimValue("country", detail.country) : "Unknown location" }} · {{ detail.language ?? "" }} · via {{ detail.referrer ?? formatDimValue("channel", detail.channel) }}
            <template v-if="detail.identity"><br />Identified as <code>{{ detail.identity.slice(2) }}</code></template>
          </p>
          <ol class="cfa-timeline">
            <li v-for="(item, index) in detail.timeline" :key="index" :class="`t-${item.type}`">
              <span class="cfa-small cfa-muted">{{ new Date(item.ts).toLocaleTimeString() }}</span>
              <div v-if="item.type === 'pv'"><strong>{{ item.path }}</strong><div v-if="item.title" class="cfa-small cfa-muted">{{ item.title }}</div></div>
              <div v-else-if="item.type === 'ev'">⚡ <strong>{{ item.name }}</strong> <span class="cfa-small cfa-muted">on {{ item.path }}</span>
                <div v-if="item.data" class="cfa-small"><code>{{ JSON.stringify(item.data) }}</code></div>
              </div>
              <div v-else>👤 identify <code v-if="item.uid">{{ item.uid }}</code> <code v-if="item.data" class="cfa-small">{{ JSON.stringify(item.data) }}</code></div>
            </li>
          </ol>
        </aside>
      </div>
    </SiteGate>
  </AnalyticsFrame>
</template>

<style>
.cfa-sessions { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; align-items: start; }
.cfa-sessions.has-detail { grid-template-columns: minmax(0, 1fr) minmax(0, 360px); }
@media (max-width: 1000px) { .cfa-sessions.has-detail { grid-template-columns: minmax(0, 1fr); } }
.cfa-session-row { cursor: pointer; }
.cfa-session-row:hover td, .cfa-session-row.active td { background: var(--cfa-accent-soft); }
.cfa-session-detail { position: sticky; top: 72px; max-height: calc(100vh - 96px); overflow: auto; }
.cfa-timeline { list-style: none; margin: 8px 0 0; padding: 0 0 0 14px; border-left: 2px solid var(--cfa-border); display: flex; flex-direction: column; gap: 10px; }
.cfa-timeline li { position: relative; }
.cfa-timeline li::before { content: ""; position: absolute; left: -20px; top: 5px; width: 10px; height: 10px; border-radius: 50%; background: var(--cfa-accent); }
.cfa-timeline li.t-ev::before { background: var(--cfa-good); }
.cfa-timeline li.t-id::before { background: var(--cfa-muted); }
</style>
