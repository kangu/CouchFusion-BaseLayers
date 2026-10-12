<script setup lang="ts">
/**
 * /admin/analytics/api-keys — read-only REST API keys (admin only).
 */
import { onMounted, ref } from "vue";
import AnalyticsFrame from "../components/AnalyticsFrame.vue";
import { createAnalyticsApi, errorMessage } from "../composables/useAnalyticsApi";

definePageMeta({ middleware: ["auth", "role-auth"], authAllowedRoles: ["admin"] });
useHead({ title: "API keys · Analytics" });

// composables
const api = createAnalyticsApi("/api/analytics/admin");

// local data
const keys = ref<any[]>([]);
const name = ref("");
const created = ref<string | null>(null);
const error = ref<string | null>(null);
const origin = ref("");

// local page api
const load = async () => {
  try {
    keys.value = (await api.get("api-keys")).items;
  } catch (err) {
    error.value = errorMessage(err);
  }
};

const create = async () => {
  error.value = null;
  try {
    const result = await api.post("api-keys", { name: name.value });
    created.value = result.key;
    name.value = "";
    await load();
  } catch (err) {
    error.value = errorMessage(err);
  }
};

const revoke = async (key: any) => {
  if (!window.confirm(`Revoke “${key.name}”? Apps using it stop working immediately.`)) return;
  await api.del(`api-keys/${key.id}`).catch((err) => (error.value = errorMessage(err)));
  await load();
};

// lifecycle
onMounted(() => {
  origin.value = window.location.origin;
  void load();
});
</script>

<template>
  <AnalyticsFrame title="API keys" subtitle="Read-only access to stats, metrics, realtime, sessions and reports">
    <p v-if="error" class="cfa-error">{{ error }}</p>
    <div class="cfa-grid cfa-grid-2">
      <form class="cfa-card cfa-stack" @submit.prevent="create">
        <h2>New key</h2>
        <label class="cfa-field"><span>Name</span><input v-model="name" class="cfa-input" required placeholder="Reporting dashboard" /></label>
        <div><button type="submit" class="cfa-btn cfa-btn-primary">Create key</button></div>
        <div v-if="created" class="cfa-stack" style="gap: 6px">
          <strong>Copy this key now. It won't be shown again.</strong>
          <pre class="cfa-code">{{ created }}</pre>
        </div>
      </form>
      <section class="cfa-card">
        <h2>Usage</h2>
        <pre class="cfa-code">curl -H "Authorization: Bearer cfa_…" \
  "{{ origin }}/api/analytics/v1/stats?range=30d&amp;compare=1"</pre>
        <p class="cfa-small cfa-muted">
          Endpoints: <code>GET /v1/site</code>, <code>GET /v1/stats</code>, <code>GET /v1/metrics/:dimension</code>,
          <code>GET /v1/realtime</code>, <code>GET /v1/sessions</code>, <code>POST /v1/reports/:type</code>.
          Query: <code>range</code> or <code>from</code>/<code>to</code>, <code>filters</code> (JSON), <code>limit</code>, <code>offset</code>.
        </p>
      </section>
    </div>
    <section class="cfa-card cfa-scroll-x" style="margin-top: 16px">
      <h2>Keys</h2>
      <div v-if="!keys.length" class="cfa-empty">No API keys</div>
      <table v-else class="cfa-table">
        <thead><tr><th>Name</th><th>Key</th><th>Created</th><th>Last used</th><th /></tr></thead>
        <tbody>
          <tr v-for="key in keys" :key="key.id">
            <td>{{ key.name }}</td>
            <td><code>{{ key.prefix }}…</code></td>
            <td>{{ new Date(key.createdAt).toLocaleDateString() }}<span v-if="key.createdBy" class="cfa-muted"> by {{ key.createdBy }}</span></td>
            <td>{{ key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : "Never" }}</td>
            <td><button type="button" class="cfa-btn cfa-btn-sm cfa-btn-danger" @click="revoke(key)">Revoke</button></td>
          </tr>
        </tbody>
      </table>
    </section>
  </AnalyticsFrame>
</template>
