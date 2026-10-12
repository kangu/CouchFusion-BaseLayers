<script setup lang="ts">
/**
 * /admin/analytics/share/:token — public, read-only dashboard (no login).
 */
import AnalyticsFrame from "../components/AnalyticsFrame.vue";
import AnalyticsToolbar from "../components/AnalyticsToolbar.vue";
import OverviewDashboard from "../components/OverviewDashboard.vue";
import SiteGate from "../components/SiteGate.vue";
import { createAnalyticsApi } from "../composables/useAnalyticsApi";
import { useAnalyticsState } from "../composables/useAnalyticsState";

// composables
const route = useRoute();
const token = String(route.params.token || "");
const api = createAnalyticsApi(`/api/analytics/share/${encodeURIComponent(token)}`, true);
const state = useAnalyticsState(api);

useHead({ title: "Shared analytics", meta: [{ name: "robots", content: "noindex, nofollow" }] });
</script>

<template>
  <div class="cfa-share-page">
    <AnalyticsFrame :title="state.site.value?.name ?? 'Analytics'" subtitle="Read-only shared dashboard">
      <SiteGate :state="state" :admin-link="false">
        <AnalyticsToolbar :state="state" :show-site="false" />
        <OverviewDashboard :api="api" :state="state" />
      </SiteGate>
    </AnalyticsFrame>
  </div>
</template>

<style>
.cfa-share-page { min-height: 100vh; background: #f9fafb; }
</style>
