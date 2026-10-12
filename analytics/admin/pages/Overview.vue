<script setup lang="ts">
/**
 * /admin/analytics — dashboard overview.
 */
import AnalyticsFrame from "../components/AnalyticsFrame.vue";
import AnalyticsToolbar from "../components/AnalyticsToolbar.vue";
import OverviewDashboard from "../components/OverviewDashboard.vue";
import SegmentPicker from "../components/SegmentPicker.vue";
import SiteGate from "../components/SiteGate.vue";
import { createAnalyticsApi } from "../composables/useAnalyticsApi";
import { useAnalyticsState } from "../composables/useAnalyticsState";

definePageMeta({ middleware: ["auth", "role-auth"], authAllowedRoles: ["admin", "analytics_viewer"] });
useHead({ title: "Analytics" });

// composables
const api = createAnalyticsApi("/api/analytics/admin");
const state = useAnalyticsState(api);
</script>

<template>
  <AnalyticsFrame title="Analytics" subtitle="Cookieless, self-hosted traffic analytics">
    <template #actions>
      <NuxtLink class="cfa-btn" to="/admin/analytics/realtime">● Realtime</NuxtLink>
    </template>
    <SiteGate :state="state">
      <AnalyticsToolbar :state="state" />
      <SegmentPicker :api="api" :state="state" style="margin: -8px 0 12px" />
      <OverviewDashboard :api="api" :state="state" />
    </SiteGate>
  </AnalyticsFrame>
</template>
