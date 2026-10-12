<script setup lang="ts">
/**
 * /admin/analytics/tools — tracking pixels, tracked short links, and imports
 * from Umami / Fathom Lite (admin only).
 */
import { onMounted, reactive, ref, watch } from "vue";
import AnalyticsFrame from "../components/AnalyticsFrame.vue";
import AnalyticsToolbar from "../components/AnalyticsToolbar.vue";
import SiteGate from "../components/SiteGate.vue";
import { createAnalyticsApi, errorMessage } from "../composables/useAnalyticsApi";
import { useAnalyticsState } from "../composables/useAnalyticsState";

definePageMeta({ middleware: ["auth", "role-auth"], authAllowedRoles: ["admin"] });
useHead({ title: "Pixels, links & import · Analytics" });

// composables
const api = createAnalyticsApi("/api/analytics/admin");
const state = useAnalyticsState(api);

// local data
const pixels = ref<any[]>([]);
const links = ref<any[]>([]);
const pixelName = ref("");
const linkForm = reactive({ slug: "", url: "", name: "" });
const importForm = reactive<Record<string, string>>({ format: "umami", events: "", sessions: "", siteStats: "", pageStats: "", referrerStats: "" });
const importing = ref(false);
const importResult = ref<any>(null);
const error = ref<string | null>(null);
const origin = ref("");

// local page api
const base = () => `site`;

const load = async () => {
  if (!state.siteId.value) return;
  try {
    const [p, l] = await Promise.all([api.get(`${base()}/pixels`), api.get(`${base()}/links`)]);
    pixels.value = p.items;
    links.value = l.items;
  } catch (err) {
    error.value = errorMessage(err);
  }
};

const act = async (action: () => Promise<any>) => {
  error.value = null;
  try {
    await action();
    await load();
  } catch (err) {
    error.value = errorMessage(err);
  }
};

const addPixel = () => act(async () => {
  await api.post(`${base()}/pixels`, { name: pixelName.value });
  pixelName.value = "";
});
const addLink = () => act(async () => {
  await api.post(`${base()}/links`, { ...linkForm });
  Object.assign(linkForm, { slug: "", url: "", name: "" });
});
const removePixel = (token: string) => window.confirm("Delete this pixel?") && act(() => api.del(`${base()}/pixels/${token}`));
const removeLink = (slug: string) => window.confirm("Delete this link?") && act(() => api.del(`${base()}/links/${slug}`));
const copy = (text: string) => navigator.clipboard?.writeText(text);

const readFile = (key: string, event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => (importForm[key] = String(reader.result ?? ""));
  reader.readAsText(file);
};

const runImport = async () => {
  importing.value = true;
  importResult.value = null;
  error.value = null;
  try {
    const body = importForm.format === "umami"
      ? { format: "umami", events: importForm.events, sessions: importForm.sessions || undefined }
      : { format: "fathom", siteStats: importForm.siteStats || undefined, pageStats: importForm.pageStats || undefined, referrerStats: importForm.referrerStats || undefined };
    importResult.value = await api.post(`${base()}/import`, body);
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    importing.value = false;
  }
};

// lifecycle
onMounted(() => {
  origin.value = window.location.origin;
});

// watchers
watch(() => state.siteId.value, () => void load(), { immediate: true });
</script>

<template>
  <AnalyticsFrame title="Pixels, links & import" subtitle="Track emails and external placements, shorten links, bring in history">
    <SiteGate :state="state">
      <AnalyticsToolbar :state="state" :show-compare="false" />
      <p v-if="error" class="cfa-error">{{ error }}</p>
      <div class="cfa-grid cfa-grid-2">
        <section class="cfa-card cfa-stack">
          <h2>Tracking pixels</h2>
          <p class="cfa-small cfa-muted" style="margin: 0">An invisible 1×1 image for emails or third-party pages. Each load is recorded as a <code>pixel-view</code> event.</p>
          <form class="cfa-row" @submit.prevent="addPixel">
            <input v-model="pixelName" class="cfa-input" required placeholder="october-newsletter" />
            <button type="submit" class="cfa-btn cfa-btn-primary">Create pixel</button>
          </form>
          <div v-for="pixel in pixels" :key="pixel.token" class="cfa-stack" style="gap: 4px">
            <div class="cfa-row" style="justify-content: space-between"><strong>{{ pixel.name }}</strong>
              <span class="cfa-row"><button type="button" class="cfa-btn cfa-btn-sm" @click="copy(`<img src=&quot;${origin}/api/analytics/p/${pixel.token}.gif&quot; width=&quot;1&quot; height=&quot;1&quot; alt=&quot;&quot;>`)">Copy HTML</button>
                <button type="button" class="cfa-btn cfa-btn-sm cfa-btn-danger" @click="removePixel(pixel.token)">Delete</button></span></div>
            <code class="cfa-small cfa-truncate">{{ origin }}/api/analytics/p/{{ pixel.token }}.gif</code>
          </div>
        </section>
        <section class="cfa-card cfa-stack">
          <h2>Tracked links</h2>
          <p class="cfa-small cfa-muted" style="margin: 0">Short links that record a <code>link-click</code> event, then redirect.</p>
          <form class="cfa-stack" style="gap: 6px" @submit.prevent="addLink">
            <input v-model="linkForm.url" class="cfa-input" type="url" required placeholder="https://destination.example/page" />
            <div class="cfa-row">
              <input v-model="linkForm.slug" class="cfa-input" placeholder="slug (optional)" pattern="[A-Za-z0-9_\-]{2,64}" />
              <input v-model="linkForm.name" class="cfa-input" placeholder="label (optional)" />
              <button type="submit" class="cfa-btn cfa-btn-primary">Create link</button>
            </div>
          </form>
          <table v-if="links.length" class="cfa-table">
            <tr v-for="link in links" :key="link.slug">
              <td><code>/l/{{ link.slug }}</code><div class="cfa-small cfa-muted cfa-truncate" style="max-width: 280px">{{ link.url }}</div></td>
              <td class="cfa-num"><button type="button" class="cfa-btn cfa-btn-sm" @click="copy(`${origin}/l/${link.slug}`)">Copy</button>
                <button type="button" class="cfa-btn cfa-btn-sm cfa-btn-danger" @click="removeLink(link.slug)">Delete</button></td>
            </tr>
          </table>
        </section>
      </div>

      <section class="cfa-card cfa-stack" style="margin-top: 16px">
        <h2>Import historical data</h2>
        <div class="cfa-row">
          <label class="cfa-check"><input v-model="importForm.format" type="radio" value="umami" /> Umami (event export)</label>
          <label class="cfa-check"><input v-model="importForm.format" type="radio" value="fathom" /> Fathom Lite (aggregate tables)</label>
        </div>
        <template v-if="importForm.format === 'umami'">
          <p class="cfa-small cfa-muted" style="margin: 0">
            Upload the <code>website_event</code> CSV (columns like <code>session_id, created_at, url_path, url_query, referrer_domain, page_title, event_type, event_name</code>)
            and optionally the <code>session</code> CSV (<code>session_id, hostname, browser, os, device, screen, language, country, subdivision1, city</code>).
            Rows become raw events, so filters and reports include them. Re-importing the same file is skipped as duplicates.
          </p>
          <label class="cfa-field"><span>website_event.csv</span><input class="cfa-input" type="file" accept=".csv,text/csv" @change="readFile('events', $event)" /></label>
          <label class="cfa-field"><span>session.csv (optional)</span><input class="cfa-input" type="file" accept=".csv,text/csv" @change="readFile('sessions', $event)" /></label>
        </template>
        <template v-else>
          <p class="cfa-small cfa-muted" style="margin: 0">
            Export Fathom Lite's hourly tables with hostnames/pathnames resolved:
            <code>site_stats (ts, pageviews, visitors, sessions, bounce_rate, avg_duration)</code>,
            <code>page_stats (ts, hostname, pathname, pageviews, visitors, entries, bounce_rate, avg_duration)</code>,
            <code>referrer_stats (ts, hostname, pathname, groupname, pageviews, visitors, bounce_rate, avg_duration)</code>.
            They are stored as imported daily rollups. Dashboards include them; raw-only filters and reports don't. Re-importing a day replaces it.
          </p>
          <label class="cfa-field"><span>site_stats.csv</span><input class="cfa-input" type="file" accept=".csv,text/csv" @change="readFile('siteStats', $event)" /></label>
          <label class="cfa-field"><span>page_stats.csv</span><input class="cfa-input" type="file" accept=".csv,text/csv" @change="readFile('pageStats', $event)" /></label>
          <label class="cfa-field"><span>referrer_stats.csv</span><input class="cfa-input" type="file" accept=".csv,text/csv" @change="readFile('referrerStats', $event)" /></label>
        </template>
        <div class="cfa-row">
          <button type="button" class="cfa-btn cfa-btn-primary" :disabled="importing" @click="runImport">{{ importing ? "Importing…" : "Import" }}</button>
          <code v-if="importResult" class="cfa-small">{{ JSON.stringify(importResult) }}</code>
        </div>
      </section>
    </SiteGate>
  </AnalyticsFrame>
</template>
