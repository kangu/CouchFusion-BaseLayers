<script setup lang="ts">
/**
 * Time-series chart (visitors + pageviews, optional previous period) rendered
 * with ApexCharts, loaded client-side only.
 */
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";

// props
const props = defineProps<{
  series: Array<{ t: string; pageviews: number; visitors: number; visits?: number }>;
  previous?: Array<{ t: string; pageviews: number; visitors: number }> | null;
  grain?: "hour" | "day" | "month" | "minute";
  height?: number;
  bars?: boolean;
}>();

// local data
const el = ref<HTMLElement | null>(null);
const chart = shallowRef<any>(null);
const failed = ref(false);
let observer: MutationObserver | null = null;

// local page api
/** Reads the chart palette from the `.cfa` design tokens (follows the workspace theme). */
const tokens = () => {
  const styles = el.value ? getComputedStyle(el.value) : null;
  const read = (name: string, fallback: string) => styles?.getPropertyValue(name).trim() || fallback;
  return {
    series: [read("--cfa-chart-1", "#f97316"), read("--cfa-chart-2", "#64748b"), read("--cfa-chart-3", "#cbd5e1")],
    grid: read("--cfa-chart-grid", "#e5e7eb"),
    text: read("--cfa-muted", "#6b7280"),
    curve: read("--cfa-chart-curve", "smooth"),
    markers: Number.parseFloat(read("--cfa-chart-marker-size", "0")) || 0,
    dark: Boolean(el.value?.closest(".dark, [data-theme='dark'], .cfa-dark")),
  };
};

const label = (t: string) => {
  if (props.grain === "minute") return new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (props.grain === "hour") return t.slice(11, 16) + (props.series.length > 24 ? ` ${t.slice(5, 10)}` : "");
  if (props.grain === "month") return t;
  return t.slice(5);
};

const buildOptions = () => {
  const palette = tokens();
  const series: any[] = [
    { name: "Visitors", type: props.bars ? "bar" : "area", data: props.series.map((p) => p.visitors) },
    { name: "Pageviews", type: props.bars ? "bar" : "line", data: props.series.map((p) => p.pageviews) },
  ];
  if (props.previous?.length) {
    series.push({ name: "Visitors (previous)", type: "line", data: props.series.map((_, i) => props.previous?.[i]?.visitors ?? null) });
  }
  return {
    chart: { type: "line", height: props.height ?? 260, toolbar: { show: false }, zoom: { enabled: false }, animations: { enabled: false }, background: "transparent", fontFamily: "inherit" },
    theme: { mode: palette.dark ? "dark" : "light" },
    series,
    colors: palette.series,
    stroke: { width: props.bars ? 0 : [2, 2, 2], curve: palette.curve, dashArray: [0, 0, 5] },
    markers: { size: props.bars ? 0 : palette.markers, strokeWidth: 0, hover: { sizeOffset: 2 } },
    fill: { type: props.bars ? "solid" : ["gradient", "solid", "solid"], gradient: { opacityFrom: 0.35, opacityTo: 0.02 } },
    dataLabels: { enabled: false },
    legend: { position: "top", horizontalAlign: "right", labels: { colors: palette.text } },
    grid: { borderColor: palette.grid, strokeDashArray: 3 },
    xaxis: { categories: props.series.map((p) => label(p.t)), tickAmount: Math.min(12, props.series.length), labels: { rotate: 0, hideOverlappingLabels: true, style: { colors: palette.text } }, axisTicks: { show: false }, axisBorder: { color: palette.grid } },
    yaxis: { min: 0, forceNiceScale: true, labels: { style: { colors: palette.text }, formatter: (v: number) => (Number.isFinite(v) ? String(Math.round(v)) : "") } },
    tooltip: { shared: true, intersect: false, x: { formatter: (_: number, o: any) => props.series[o?.dataPointIndex]?.t ?? "" } },
    plotOptions: { bar: { columnWidth: "70%", borderRadius: 2 } },
  };
};

const render = async () => {
  if (!el.value) return;
  try {
    const ApexCharts = (await import("apexcharts")).default;
    if (chart.value) {
      await chart.value.updateOptions(buildOptions(), true, false);
    } else {
      chart.value = new ApexCharts(el.value, buildOptions());
      await chart.value.render();
    }
  } catch (error) {
    console.warn("[analytics] chart failed", error);
    failed.value = true;
  }
};

// lifecycle
onMounted(() => {
  // Re-render when the workspace toggles a dark class on <html>/<body>.
  observer = new MutationObserver(() => void render());
  for (const node of [document.documentElement, document.body]) {
    observer.observe(node, { attributes: true, attributeFilter: ["class", "data-theme"] });
  }
  void render();
});

onBeforeUnmount(() => {
  observer?.disconnect();
  chart.value?.destroy();
  chart.value = null;
});

// watchers
watch(() => [props.series, props.previous, props.grain], () => void render(), { deep: true });
</script>

<template>
  <div class="cfa-chart">
    <div ref="el" :style="{ minHeight: `${height ?? 260}px` }" />
    <table v-if="failed" class="cfa-table">
      <tr v-for="point in series" :key="point.t"><td>{{ point.t }}</td><td class="cfa-num">{{ point.visitors }}</td><td class="cfa-num">{{ point.pageviews }}</td></tr>
    </table>
  </div>
</template>
