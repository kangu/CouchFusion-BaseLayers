<script setup lang="ts">
/**
 * Loads status and the app's website, then renders the slot.
 */
import { onMounted } from "vue";
import type { AnalyticsState } from "../composables/useAnalyticsState";

// props
const props = defineProps<{
  state: AnalyticsState;
}>();

// lifecycle
onMounted(() => {
  if (!props.state.sites.value.length) void props.state.loadSites();
});
</script>

<template>
  <div>
    <p v-if="state.siteError.value" class="cfa-error">{{ state.siteError.value }}</p>
    <div v-else-if="state.loadingSites.value && !state.sites.value.length" class="cfa-empty">Loading…</div>
    <slot v-else-if="state.site.value" />
  </div>
</template>
