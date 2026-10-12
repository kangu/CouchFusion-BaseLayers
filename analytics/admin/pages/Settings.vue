<script setup lang="ts">
/**
 * /admin/analytics/settings — settings for this app's website: tracking rules,
 * goals, sharing, engine options and data maintenance (admin only).
 * Each app tracks exactly one website, so there is nothing to add or pick.
 */
import { computed, onMounted, reactive, ref } from "vue";
import AnalyticsFrame from "../components/AnalyticsFrame.vue";
import { createAnalyticsApi, errorMessage } from "../composables/useAnalyticsApi";

definePageMeta({ middleware: ["auth", "role-auth"], authAllowedRoles: ["admin"] });
useHead({ title: "Settings · Analytics" });

// composables
const api = createAnalyticsApi("/api/analytics/admin");

// local data
const status = ref<any>(null);
const site = ref<any>(null);
const error = ref<string | null>(null);
const notice = ref<string | null>(null);
const saving = ref(false);
const form = reactive<any>({ goals: [] });
const rebuild = reactive({ from: "", to: "" });
const resetConfirm = ref("");
const origin = ref("");
const timezones = ref<string[]>(["UTC"]);
const engine = reactive<Record<string, string>>({});
const engineSection = ref("");

const ENGINE_FIELDS = [
  { key: "analytics_mode", label: "Mode", options: ["self_hosted", "dual", "umami_cloud"], placeholder: "umami_cloud" },
  { key: "analytics_ignore_ips", label: "Ignored IPs / CIDRs (comma-separated)", placeholder: "203.0.113.4, 10.0.0.0/8" },
  { key: "analytics_respect_dnt", label: "Respect Do-Not-Track / GPC", options: ["true", "false"], placeholder: "true" },
  { key: "analytics_raw_retention_months", label: "Raw event retention (months)", placeholder: "13" },
  { key: "analytics_max_scan_days", label: "Max days for filtered views and reports", placeholder: "31" },
  { key: "analytics_persistent_id", label: "Persistent visitor id (consent required)", options: ["false", "true"], placeholder: "false" },
  { key: "analytics_geo_source", label: "Geo source", options: ["header", "none"], placeholder: "header" },
  { key: "analytics_aggregator_enabled", label: "Run aggregator on this instance", options: ["true", "false"], placeholder: "true" },
];

const OUTCOME_LABELS: Record<string, string> = {
  dnt: "sent Do-Not-Track or Global Privacy Control",
  bot: "looked like a bot or script",
  excluded: "were on an excluded path",
  host: "came from a hostname not in Domains",
  ignored_ip: "came from an ignored IP",
  disabled: "arrived while collecting was off",
  rate_limited: "were rate limited",
  invalid: "were malformed",
};

// computed
/** Dropped-hit reasons since the server started, most frequent first. */
const dropped = computed(() =>
  Object.entries((status.value?.outcomes ?? {}) as Record<string, number>)
    .filter(([key, count]) => key !== "stored" && count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => `${count} ${OUTCOME_LABELS[key] ?? key}`),
);
const shareUrl = computed(() => (site.value?.shareToken ? `${origin.value}/admin/analytics/share/${site.value.shareToken}` : ""));
const scriptSnippet = computed(() => `<script defer src="${origin.value}/a.js"><\/script>`);
const offSnippet = computed(() => `# CouchDB _config section ${status.value?.section ?? "cf_env_<slug>"}\nanalytics_mode = self_hosted`);

// local page api
const fill = (value: any) => {
  Object.assign(form, {
    name: value?.name ?? "",
    domainsText: (value?.domains ?? []).join("\n"),
    timezone: value?.timezone ?? "UTC",
    excludedText: (value?.excludedPaths ?? []).join("\n"),
    keepQuery: value?.keepQuery ?? false,
    keepHash: value?.keepHash ?? false,
    enabled: value?.enabled ?? true,
    rolesText: (value?.allowedRoles ?? []).join(", "),
    goals: JSON.parse(JSON.stringify(value?.goals ?? [])),
  });
};

const load = async () => {
  error.value = null;
  try {
    const [statusResult, settingsResult] = await Promise.all([api.get("status"), api.get("settings")]);
    status.value = statusResult;
    engineSection.value = settingsResult.section;
    for (const field of ENGINE_FIELDS) engine[field.key] = settingsResult.values?.[field.key] ?? "";
    if (statusResult.storesLocally) {
      site.value = (await api.get("site")).site;
      fill(site.value);
    } else {
      site.value = null;
    }
  } catch (err) {
    error.value = errorMessage(err);
  }
};

const run = async (label: string, action: () => Promise<any>) => {
  error.value = null;
  notice.value = null;
  try {
    const result = await action();
    notice.value = result && !result.site && !result.ok ? `${label}: ${JSON.stringify(result)}` : label;
    await load();
  } catch (err) {
    error.value = errorMessage(err);
  }
};

const save = async () => {
  saving.value = true;
  await run("Website settings saved", () =>
    api.put("site", {
      name: form.name,
      domains: form.domainsText,
      timezone: form.timezone,
      excludedPaths: form.excludedText,
      keepQuery: form.keepQuery,
      keepHash: form.keepHash,
      enabled: form.enabled,
      allowedRoles: form.rolesText,
      goals: form.goals.filter((goal: any) => goal.value),
    }),
  );
  saving.value = false;
};

const saveEngine = () => run("Engine settings saved (applied within a minute)", () => api.put("settings", { values: { ...engine } }));
const toggleShare = (enabled: boolean) => run(enabled ? "Share link created" : "Share link revoked", () => api.post("site/share", { enabled }));
const doRebuild = () => run("Rebuilt", () => api.post("site/rebuild", { ...rebuild }));
const doReset = async () => {
  await run("Data reset", () => api.post("site/reset", { confirm: resetConfirm.value }));
  resetConfirm.value = "";
};
const addGoal = () => form.goals.push({ name: "", type: "path", value: "" });
const copy = (text: string) => navigator.clipboard?.writeText(text).then(() => (notice.value = "Copied to clipboard"));

// lifecycle
onMounted(() => {
  origin.value = window.location.origin;
  try {
    timezones.value = (Intl as any).supportedValuesOf?.("timeZone") ?? ["UTC"];
  } catch {
    timezones.value = ["UTC"];
  }
  void load();
});
</script>

<template>
  <AnalyticsFrame title="Settings" :subtitle="site ? `Analytics settings for ${site.name}` : 'Analytics settings for this website'">
    <p v-if="error" class="cfa-error">{{ error }}</p>
    <p v-if="notice" class="cfa-badge" style="margin-bottom: 12px">{{ notice }}</p>

    <div class="cfa-stack">
      <section v-if="status && !status.storesLocally" class="cfa-card">
        <h2>Built-in analytics is off</h2>
        <p class="cfa-muted">The mode is <code>{{ status.mode }}</code>, so nothing is stored here. Switch the mode to <code>self_hosted</code> under Engine below, or in CouchDB:</p>
        <pre class="cfa-code">{{ offSnippet }}</pre>
      </section>

      <form v-if="site" class="cfa-card cfa-stack" @submit.prevent="save">
        <div class="cfa-row" style="justify-content: space-between">
          <h2 style="margin: 0">Website</h2>
          <span class="cfa-badge">id: {{ site.id }}</span>
        </div>
        <div class="cfa-grid cfa-grid-2">
          <label class="cfa-field"><span>Name</span><input v-model="form.name" class="cfa-input" required /></label>
          <label class="cfa-field"><span>Timezone (day boundaries)</span>
            <select v-model="form.timezone" class="cfa-select"><option v-for="tz in timezones" :key="tz" :value="tz">{{ tz }}</option></select>
          </label>
          <label class="cfa-field"><span>Domains (one per line; subdomains included; empty = accept any hostname)</span>
            <textarea v-model="form.domainsText" class="cfa-textarea" placeholder="example.com" />
          </label>
          <label class="cfa-field"><span>Excluded paths (exact, or prefix ending in *)</span>
            <textarea v-model="form.excludedText" class="cfa-textarea" placeholder="/admin*" />
          </label>
          <label class="cfa-field"><span>Viewer roles (CouchDB roles with read-only access)</span>
            <input v-model="form.rolesText" class="cfa-input" placeholder="analytics_viewer" />
          </label>
        </div>
        <div class="cfa-row">
          <label class="cfa-check"><input v-model="form.enabled" type="checkbox" /> Collecting</label>
          <label class="cfa-check"><input v-model="form.keepQuery" type="checkbox" /> Keep query strings</label>
          <label class="cfa-check"><input v-model="form.keepHash" type="checkbox" /> Keep URL hash</label>
        </div>
        <div>
          <h3>Goals</h3>
          <p class="cfa-small cfa-muted">A goal is a page path (prefix* allowed) or a custom event name. Used by the Goals report.</p>
          <div v-for="(goal, index) in form.goals" :key="index" class="cfa-row" style="margin-bottom: 6px">
            <input v-model="goal.name" class="cfa-input" placeholder="Name" />
            <select v-model="goal.type" class="cfa-select"><option value="path">Page</option><option value="event">Event</option></select>
            <input v-model="goal.value" class="cfa-input" :placeholder="goal.type === 'path' ? '/thank-you' : 'signup'" />
            <button type="button" class="cfa-btn cfa-btn-sm" @click="form.goals.splice(index, 1)">Remove</button>
          </div>
          <button type="button" class="cfa-btn cfa-btn-sm" @click="addGoal">+ Goal</button>
        </div>
        <div><button type="submit" class="cfa-btn cfa-btn-primary" :disabled="saving">{{ saving ? "Saving…" : "Save website settings" }}</button></div>
      </form>

      <section v-if="site" class="cfa-card">
        <h2>Tracking</h2>
        <p class="cfa-muted">
          This app is tracked automatically: every page view and every <code>trackEvent()</code> / <code>v-analytics</code> call is recorded for this website. There is nothing to install and no website id to pass.
        </p>
        <p class="cfa-muted" style="margin-top: 12px">
          If part of this website is served outside the Nuxt app (a landing page, a docs site on a subdomain), add this script there. The page's domain must be listed under Domains above.
        </p>
        <pre class="cfa-code">{{ scriptSnippet }}</pre>
        <div class="cfa-row" style="margin-top: 8px">
          <button type="button" class="cfa-btn cfa-btn-sm" @click="copy(scriptSnippet)">Copy script</button>
          <span class="cfa-small cfa-muted">Options: data-auto-track="false", data-domains, data-tag, data-exclude-search, data-exclude-hash, data-do-not-track. API: <code>umami.track(name, data)</code>, <code>umami.identify(id, data)</code>.</span>
        </div>
      </section>

      <section v-if="site" class="cfa-card">
        <h2>Public share link</h2>
        <p class="cfa-muted">Anyone with the link can view a read-only dashboard.</p>
        <div v-if="shareUrl" class="cfa-row">
          <a class="cfa-code cfa-truncate" :href="shareUrl" target="_blank" rel="noopener" style="max-width: 100%">{{ shareUrl }}</a>
          <button type="button" class="cfa-btn cfa-btn-sm" @click="copy(shareUrl)">Copy</button>
          <button type="button" class="cfa-btn cfa-btn-sm" @click="toggleShare(true)">Rotate</button>
          <button type="button" class="cfa-btn cfa-btn-sm cfa-btn-danger" @click="toggleShare(false)">Revoke</button>
        </div>
        <button v-else type="button" class="cfa-btn" @click="toggleShare(true)">Create share link</button>
      </section>

      <form v-if="status" class="cfa-card cfa-stack" @submit.prevent="saveEngine">
        <div class="cfa-row" style="justify-content: space-between">
          <h2 style="margin: 0">Engine</h2>
          <span class="cfa-badge">{{ engineSection }}</span>
        </div>
        <p class="cfa-small cfa-muted" style="margin: 0">Stored in CouchDB <code>_config</code>. Leave a field empty to use its default.</p>
        <div class="cfa-grid cfa-grid-3">
          <label v-for="field in ENGINE_FIELDS" :key="field.key" class="cfa-field">
            <span>{{ field.label }}</span>
            <select v-if="field.options" v-model="engine[field.key]" class="cfa-select">
              <option value="">(default: {{ field.placeholder }})</option>
              <option v-for="option in field.options" :key="option" :value="option">{{ option }}</option>
            </select>
            <input v-else v-model="engine[field.key]" class="cfa-input" :placeholder="field.placeholder" />
          </label>
        </div>
        <p v-if="status.storesLocally && status.geo" class="cfa-small cfa-muted" style="margin: 0">
          Country detection: <strong>{{ status.geo.withCountry }}</strong> of {{ status.geo.stored }} hits since this server started carried a country
          <template v-if="status.geo.stored && !status.geo.withCountry">. None so far: check that the site is proxied through Cloudflare and that your reverse proxy forwards the <code>CF-IPCountry</code> header.</template>
          <template v-else>.</template>
        </p>
        <p v-if="status.storesLocally" class="cfa-small cfa-muted" style="margin: 0">
          Since this server started: <strong>{{ status.outcomes?.stored ?? 0 }}</strong> hits stored<template v-if="dropped.length">; dropped: {{ dropped.join(", ") }}</template>.
          <template v-if="status.outcomes?.dnt"> To count browsers that send those privacy signals, set "Respect Do-Not-Track / GPC" to false.</template>
        </p>
        <p class="cfa-small cfa-muted" style="margin: 0"><code>self_hosted</code> stores everything here. <code>dual</code> also forwards to Umami Cloud; <code>umami_cloud</code> only forwards (both legacy).</p>
        <div><button type="submit" class="cfa-btn cfa-btn-primary">Save engine settings</button></div>
      </form>

      <section v-if="site" class="cfa-card cfa-stack">
        <h2>Data</h2>
        <div class="cfa-row">
          <span class="cfa-muted">Recompute dashboard totals from raw events:</span>
          <input v-model="rebuild.from" class="cfa-input" type="date" aria-label="Rebuild from" />
          <input v-model="rebuild.to" class="cfa-input" type="date" aria-label="Rebuild to" />
          <button type="button" class="cfa-btn" :disabled="!rebuild.from" @click="doRebuild">Rebuild</button>
        </div>
        <div class="cfa-row">
          <span class="cfa-muted">Delete all collected analytics data. Type <code>{{ site.id }}</code> to confirm:</span>
          <input v-model="resetConfirm" class="cfa-input" aria-label="Confirm website id" />
          <button type="button" class="cfa-btn cfa-btn-danger" :disabled="resetConfirm !== site.id" @click="doReset">Reset all data</button>
        </div>
      </section>
    </div>
  </AnalyticsFrame>
</template>
