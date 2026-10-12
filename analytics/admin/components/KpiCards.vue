<script setup lang="ts">
/**
 * KPI row: visitors, visits, pageviews, bounce rate, visit duration (+ deltas).
 */
import { computed } from "vue";
import { changePercent, formatDuration, formatMoney, formatNumber, formatPercent } from "../utils/format";

// props
const props = defineProps<{
  totals: Record<string, number> | null;
  previous?: Record<string, number> | null;
  revenue?: Record<string, number> | null;
}>();

// computed
const cards = computed(() => {
  const t = props.totals ?? {};
  const p = props.previous ?? undefined;
  const list = [
    { key: "visitors", label: "Visitors", value: formatNumber(t.visitors), raw: t.visitors, invert: false },
    { key: "visits", label: "Visits", value: formatNumber(t.visits), raw: t.visits, invert: false },
    { key: "pageviews", label: "Pageviews", value: formatNumber(t.pageviews), raw: t.pageviews, invert: false },
    { key: "viewsPerVisit", label: "Views / visit", value: String(t.viewsPerVisit ?? 0), raw: t.viewsPerVisit, invert: false },
    { key: "bounceRate", label: "Bounce rate", value: formatPercent(t.bounceRate), raw: t.bounceRate, invert: true },
    { key: "avgDuration", label: "Visit duration", value: formatDuration(t.avgDuration), raw: t.avgDuration, invert: false },
  ];
  if (t.events) list.push({ key: "events", label: "Events", value: formatNumber(t.events), raw: t.events, invert: false });
  return list.map((card) => ({ ...card, change: p ? changePercent(card.raw ?? 0, p[card.key]) : null }));
});
const revenueEntries = computed(() => Object.entries(props.revenue ?? {}));
</script>

<template>
  <div class="cfa-kpis">
    <div v-for="card in cards" :key="card.key" class="cfa-kpi">
      <div class="cfa-kpi-label">{{ card.label }}</div>
      <div class="cfa-kpi-value">{{ card.value }}</div>
      <div
        v-if="card.change !== null"
        class="cfa-kpi-change"
        :class="{ up: (card.change ?? 0) > 0 !== card.invert && card.change !== 0, down: (card.change ?? 0) < 0 !== card.invert && card.change !== 0 }"
      >
        {{ (card.change ?? 0) > 0 ? "▲" : (card.change ?? 0) < 0 ? "▼" : "•" }} {{ Math.abs(card.change ?? 0) }}%
      </div>
    </div>
    <div v-for="[currency, amount] in revenueEntries" :key="currency" class="cfa-kpi">
      <div class="cfa-kpi-label">Revenue ({{ currency }})</div>
      <div class="cfa-kpi-value">{{ formatMoney(amount, currency) }}</div>
    </div>
  </div>
</template>

<style>
.cfa-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 16px; }
.cfa-kpi { background: var(--cfa-surface); border: 1px solid var(--cfa-border); border-radius: var(--cfa-radius); padding: 12px 14px; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); min-width: 0; }
.cfa-kpi-label { font-size: 12px; color: var(--cfa-muted); font-weight: 500; }
.cfa-kpi-value { font-size: 24px; font-weight: 650; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
.cfa-kpi-change { font-size: 12px; color: var(--cfa-muted); font-variant-numeric: tabular-nums; }
.cfa-kpi-change.up { color: var(--cfa-good); }
.cfa-kpi-change.down { color: var(--cfa-bad); }
</style>
