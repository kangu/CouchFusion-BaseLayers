<script setup lang="ts">
/**
 * Loads status and the app's website, then renders the slot.
 */
import { onMounted } from "vue";
import type { AnalyticsState } from "../composables/useAnalyticsState";

// props
const props = withDefaults(defineProps<{
  state: AnalyticsState;
  adminLink?: boolean;
}>(), { adminLink: true });

// lifecycle
onMounted(() => {
  if (!props.state.sites.value.length) void props.state.loadSites();
});
</script>

<template>
  <div>
    <p v-if="state.siteError.value" class="cfa-error">{{ state.siteError.value }}</p>
    <div v-else-if="state.loadingSites.value && !state.sites.value.length" class="cfa-empty">Loading…</div>
    <div v-else-if="state.status.value && !state.status.value.storesLocally" class="cfa-card">
      <!-- adminLink: share pages hide the settings link -->
      <h2>Self-hosted analytics is off</h2>
      <p class="cfa-muted">
        This app runs in <code>{{ state.status.value.mode }}</code> mode. Set
        <code>{{ state.status.value.section }}.analytics_mode</code> to <code>dual</code> or <code>self_hosted</code>
        in CouchDB <code>_config</code> to start collecting locally.
      </p>
      <NuxtLink v-if="adminLink" class="cfa-btn cfa-btn-primary" to="/admin/analytics/settings">Open settings</NuxtLink>
    </div>
    <slot v-else-if="state.site.value" />
  </div>
</template>
