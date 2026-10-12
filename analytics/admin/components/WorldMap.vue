<script setup lang="ts">
/**
 * Dotted world map of visitors by country, drawn on a canvas from static dot
 * grids. At world view a click zooms into the continent (a finer grid is
 * loaded on demand). When zoomed, clicking a visiting country filters by it and
 * clicking anywhere else zooms out. Hover shows a tooltip.
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import type { AnalyticsApi } from "../composables/useAnalyticsApi";
import { errorMessage } from "../composables/useAnalyticsApi";
import type { AnalyticsState } from "../composables/useAnalyticsState";
import { countryName, flagEmoji, formatNumber } from "../utils/format";
import { WORLD_COLS, WORLD_DOTS, WORLD_REGIONS, WORLD_ROWS } from "../utils/world-dots";

// props
const props = defineProps<{
  api: AnalyticsApi;
  state: AnalyticsState;
}>();

// static data
const ROW_STEP = 0.866;
const DOT = 0.34;
const FINE_FROM_SCALE = 1.5;

interface Grid {
  cols: number;
  rows: number;
  codes: string[];
  cellCountry: Int16Array;
  cellsByCode: Map<string, number[]>;
}

/** Decodes a generated grid (delta/base-36 cell lists per country). */
const decodeGrid = (cols: number, rows: number, dots: Record<string, string>): Grid => {
  const codes = Object.keys(dots);
  const cellCountry = new Int16Array(cols * rows).fill(-1);
  const cellsByCode = new Map<string, number[]>();
  codes.forEach((code, codeIndex) => {
    let index = 0;
    const cells: number[] = [];
    for (const delta of dots[code].split(",")) {
      index += parseInt(delta, 36);
      cells.push(index);
      cellCountry[index] = codeIndex;
    }
    cellsByCode.set(code, cells);
  });
  return { cols, rows, codes, cellCountry, cellsByCode };
};

const coarse = decodeGrid(WORLD_COLS, WORLD_ROWS, WORLD_DOTS);
/** Map height in map-width units. */
const MAP_HEIGHT = ((WORLD_ROWS - 1) * ROW_STEP + 1) / (WORLD_COLS + 0.5);
const WORLD_VIEW = { cx: 0.5, cy: MAP_HEIGHT / 2, k: 1 };

const regionIds = Object.keys(WORLD_REGIONS);
const continentOf = new Map<string, string>();
for (const id of regionIds) {
  const list = WORLD_REGIONS[id].countries;
  for (let i = 0; i < list.length; i += 2) continentOf.set(list.slice(i, i + 2), id);
}

// local data
const wrap = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const rows = ref<Array<{ value: string; v?: number }>>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const hovered = ref<string | null>(null);
const tooltip = ref<{ x: number; y: number } | null>(null);
const region = ref<string | null>(null);
const overRegion = ref(false);
const fine = shallowRef<Grid | null>(null);
let view = { ...WORLD_VIEW };
let width = 0;
let height = 0;
let frame = 0;
let finePromise: Promise<void> | null = null;
let resizeObserver: ResizeObserver | null = null;
let themeObserver: MutationObserver | null = null;

// computed
const visitors = computed(() => new Map(rows.value.filter((r) => /^[A-Z]{2}$/.test(r.value)).map((r) => [r.value, r.v ?? 0])));
const scoped = computed(() => (region.value ? [...visitors.value].filter(([code]) => continentOf.get(code) === region.value) : [...visitors.value]));
const total = computed(() => [...visitors.value.values()].reduce((sum, v) => sum + v, 0));
const scopedTotal = computed(() => scoped.value.reduce((sum, [, v]) => sum + v, 0));
const max = computed(() => Math.max(1, ...visitors.value.values()));
const top = computed(() => [...scoped.value].sort((a, b) => b[1] - a[1]).slice(0, 6));
const topMax = computed(() => Math.max(1, ...top.value.map(([, v]) => v)));
const offMap = computed(() => [...visitors.value.keys()].filter((code) => !coarse.cellsByCode.has(code)).length);
/** Zoomed in and pointing at a country with visitors: a click filters. */
const canFilterHovered = computed(() => Boolean(region.value && hovered.value && visitors.value.has(hovered.value)));
const hoveredInfo = computed(() => {
  if (!hovered.value) return null;
  const count = visitors.value.get(hovered.value) ?? 0;
  return { code: hovered.value, name: countryName(hovered.value), count, share: total.value ? Math.round((count / total.value) * 1000) / 10 : 0 };
});
const summary = computed(() => {
  if (!visitors.value.size) return loading.value ? "Loading…" : "No country data for this period";
  const count = scoped.value.length;
  const prefix = region.value ? `${WORLD_REGIONS[region.value].name} · ` : "";
  return `${prefix}${count} ${count === 1 ? "country" : "countries"} · ${formatNumber(scopedTotal.value)} visitors`;
});

// local page api
const load = async () => {
  if (!props.state.siteId.value) return;
  loading.value = true;
  error.value = null;
  try {
    rows.value = (await props.api.get("site/metrics/country", { ...props.state.params.value, limit: 300 })).rows;
  } catch (err) {
    error.value = errorMessage(err);
    rows.value = [];
  } finally {
    loading.value = false;
    draw(1);
  }
};

/** Loads the 2x grid once; the zoomed view sharpens when it arrives. */
const loadFine = () => {
  finePromise ??= import("../utils/world-dots-fine")
    .then((mod) => {
      fine.value = decodeGrid(mod.FINE_COLS, mod.FINE_ROWS, mod.FINE_DOTS);
      draw(1);
    })
    .catch(() => {
      finePromise = null;
    });
  return finePromise;
};

const activeGrid = (): Grid => (fine.value && view.k >= FINE_FROM_SCALE ? fine.value : coarse);

const token = (styles: CSSStyleDeclaration, name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;

/** Draws one frame. `intro` (0-1) drives the left-to-right sweep on first paint. */
const draw = (intro: number) => {
  const el = canvas.value;
  const ctx = el?.getContext("2d");
  if (!el || !ctx || !width) return;
  const grid = activeGrid();
  const styles = getComputedStyle(el);
  const land = token(styles, "--cfa-map-land", "#d9dee5");
  const accent = token(styles, "--cfa-accent", "#f97316");
  const glow = token(styles, "--cfa-map-glow", "rgba(249,115,22,0.45)");
  const text = token(styles, "--cfa-text", "#111827");
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const unit = (width * view.k) / (grid.cols + 0.5);
  const radius = unit * DOT;
  const originX = width / 2 - view.cx * width * view.k;
  const originY = height / 2 - view.cy * width * view.k;
  const dot = (index: number, scale: number) => {
    const row = Math.floor(index / grid.cols);
    const col = index % grid.cols;
    const x = originX + (col + (row % 2 ? 0.5 : 0) + 0.5) * unit;
    const y = originY + (row * ROW_STEP + 0.5) * unit;
    if (x < -unit || x > width + unit || y < -unit || y > height + unit) return;
    const local = intro >= 1 ? 1 : Math.min(1, Math.max(0, intro * 1.6 - (col / grid.cols) * 0.6));
    if (local <= 0) return;
    const r = radius * scale * local;
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
  };

  // 1. Land without data: one path, one fill.
  ctx.beginPath();
  for (const [code, cells] of grid.cellsByCode) {
    if (visitors.value.has(code) || code === hovered.value) continue;
    for (const index of cells) dot(index, 1);
  }
  ctx.fillStyle = land;
  ctx.fill();

  // 2. Visiting countries, brighter with more visitors; soft glow.
  ctx.shadowColor = glow;
  ctx.shadowBlur = Math.min(14, unit * 1.1);
  ctx.fillStyle = accent;
  for (const [code, count] of visitors.value) {
    const cells = grid.cellsByCode.get(code);
    if (!cells || code === hovered.value) continue;
    const strength = Math.sqrt(count / max.value);
    ctx.globalAlpha = 0.42 + 0.58 * strength;
    ctx.beginPath();
    for (const index of cells) dot(index, 1.08 + 0.14 * strength);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  // 3. Hovered country on top.
  const hoverCells = hovered.value ? grid.cellsByCode.get(hovered.value) : null;
  if (hoverCells) {
    ctx.beginPath();
    for (const index of hoverCells) dot(index, 1.25);
    ctx.fillStyle = visitors.value.has(hovered.value!) ? accent : text;
    ctx.fill();
  }
};

const resize = () => {
  const el = canvas.value;
  const box = wrap.value;
  if (!el || !box || !box.clientWidth) return;
  width = box.clientWidth;
  height = width * MAP_HEIGHT;
  const dpr = window.devicePixelRatio || 1;
  el.width = Math.round(width * dpr);
  el.height = Math.round(height * dpr);
  el.style.height = `${height}px`;
  draw(1);
};

const reducedMotion = () => Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

/** Runs `tick(t)` for `duration` ms with an ease-in-out curve. */
const animate = (duration: number, tick: (t: number) => void) => {
  cancelAnimationFrame(frame);
  if (reducedMotion()) {
    tick(1);
    return;
  }
  const started = performance.now();
  const step = (now: number) => {
    const linear = Math.min(1, (now - started) / duration);
    tick(linear < 0.5 ? 4 * linear ** 3 : 1 - (-2 * linear + 2) ** 3 / 2);
    if (linear < 1) frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
};

/** View that fits a continent box inside the canvas with a little padding. */
const viewFor = (id: string | null) => {
  if (!id) return { ...WORLD_VIEW };
  const [x0, y0, x1, y1] = WORLD_REGIONS[id].box;
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, k: Math.min(1 / (x1 - x0), MAP_HEIGHT / (y1 - y0)) * 0.94 };
};

const zoomTo = (id: string | null) => {
  if (id) void loadFine();
  region.value = id;
  hovered.value = null;
  tooltip.value = null;
  const from = { ...view };
  const to = viewFor(id);
  animate(520, (t) => {
    view = { cx: from.cx + (to.cx - from.cx) * t, cy: from.cy + (to.cy - from.cy) * t, k: from.k + (to.k - from.k) * t };
    draw(1);
  });
};

/** Pointer position in map-width units. */
const toMap = (event: MouseEvent) => {
  const rect = canvas.value!.getBoundingClientRect();
  return {
    x: view.cx + (event.clientX - rect.left - width / 2) / (width * view.k),
    y: view.cy + (event.clientY - rect.top - height / 2) / (width * view.k),
  };
};

/** Country under (or right next to) a map position. */
const countryAt = (point: { x: number; y: number }): string | null => {
  const grid = activeGrid();
  const gx = point.x * (grid.cols + 0.5);
  const gy = point.y * (grid.cols + 0.5);
  const row = Math.round((gy - 0.5) / ROW_STEP);
  let best: { code: string; distance: number } | null = null;
  for (let r = row - 1; r <= row + 1; r += 1) {
    if (r < 0 || r >= grid.rows) continue;
    const col = Math.round(gx - 0.5 - (r % 2 ? 0.5 : 0));
    for (let c = col - 1; c <= col + 1; c += 1) {
      if (c < 0 || c >= grid.cols) continue;
      const codeIndex = grid.cellCountry[r * grid.cols + c];
      if (codeIndex < 0) continue;
      const distance = (c + (r % 2 ? 0.5 : 0) + 0.5 - gx) ** 2 + (r * ROW_STEP + 0.5 - gy) ** 2;
      if (distance < 1.2 && (!best || distance < best.distance)) best = { code: grid.codes[codeIndex], distance };
    }
  }
  return best?.code ?? null;
};

/** Continent to zoom into for a map position (prefers the hovered country's own). */
const regionAt = (point: { x: number; y: number }, code: string | null): string | null => {
  const inside = regionIds.filter((id) => {
    const [x0, y0, x1, y1] = WORLD_REGIONS[id].box;
    return point.x >= x0 && point.x <= x1 && point.y >= y0 && point.y <= y1;
  });
  if (!inside.length) return null;
  const own = code ? continentOf.get(code) : null;
  if (own && inside.includes(own)) return own;
  const area = (id: string) => {
    const [x0, y0, x1, y1] = WORLD_REGIONS[id].box;
    return (x1 - x0) * (y1 - y0);
  };
  return inside.sort((a, b) => area(a) - area(b))[0];
};

const onMove = (event: MouseEvent) => {
  const point = toMap(event);
  const code = countryAt(point);
  const rect = wrap.value!.getBoundingClientRect();
  tooltip.value = code ? { x: event.clientX - rect.left, y: event.clientY - rect.top } : null;
  overRegion.value = Boolean(region.value || regionAt(point, code));
  if (code !== hovered.value) {
    hovered.value = code;
    draw(1);
  }
};

const onClick = (event: MouseEvent) => {
  const point = toMap(event);
  if (region.value) {
    // Zoomed in: a visiting country filters, anything else zooms out.
    const code = countryAt(point);
    if (code && visitors.value.has(code)) filterBy(code);
    else zoomTo(null);
    return;
  }
  const target = regionAt(point, countryAt(point));
  if (target) zoomTo(target);
};

const setHover = (code: string | null) => {
  hovered.value = code;
  tooltip.value = null;
  draw(1);
};

const filterBy = (code: string) => props.state.addFilter({ dim: "country", op: "eq", value: code });

const onKey = (event: KeyboardEvent) => {
  if (event.key === "Escape" && region.value) zoomTo(null);
};

// lifecycle
onMounted(() => {
  resize();
  animate(700, (t) => draw(t));
  resizeObserver = new ResizeObserver(() => resize());
  if (wrap.value) resizeObserver.observe(wrap.value);
  // Redraw when the workspace switches theme.
  themeObserver = new MutationObserver(() => draw(1));
  for (const node of [document.documentElement, document.body]) {
    themeObserver.observe(node, { attributes: true, attributeFilter: ["class", "data-theme"] });
  }
  window.addEventListener("keydown", onKey);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  resizeObserver?.disconnect();
  themeObserver?.disconnect();
  window.removeEventListener("keydown", onKey);
});

// watchers
watch(() => [props.state.siteId.value, props.state.params.value], () => void load(), { immediate: true, deep: true });
</script>

<template>
  <section class="cfa-card cfa-world" aria-label="Visitors by country">
    <header class="cfa-world-head">
      <div>
        <h2>Where visitors come from</h2>
        <p class="cfa-small cfa-muted">{{ summary }}</p>
      </div>
      <div class="cfa-world-legend cfa-small cfa-muted" aria-hidden="true">
        fewer <span class="cfa-world-scale" /> more
      </div>
    </header>
    <nav class="cfa-world-regions" aria-label="Zoom to a continent">
      <button type="button" class="cfa-world-region" :aria-pressed="!region" @click="zoomTo(null)">World</button>
      <button
        v-for="id in regionIds"
        :key="id"
        type="button"
        class="cfa-world-region"
        :aria-pressed="region === id"
        @mouseenter="loadFine"
        @click="zoomTo(region === id ? null : id)"
      >
        {{ WORLD_REGIONS[id].name }}
      </button>
    </nav>
    <p v-if="error" class="cfa-error">{{ error }}</p>
    <div class="cfa-world-body">
      <div ref="wrap" class="cfa-world-map">
        <canvas
          ref="canvas"
          role="img"
          :aria-label="visitors.size ? `Map of ${region ? WORLD_REGIONS[region].name : 'the world'}. Top countries: ${top.map(([code, count]) => `${countryName(code)} ${count}`).join(', ')}` : 'World map, no country data'"
          :style="{ cursor: canFilterHovered ? 'pointer' : region ? 'zoom-out' : overRegion ? 'zoom-in' : 'default' }"
          @mouseenter="loadFine"
          @mousemove="onMove"
          @mouseleave="setHover(null)"
          @click="onClick"
        />
        <div v-if="hoveredInfo && tooltip" class="cfa-world-tip" :style="{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }">
          <strong>{{ flagEmoji(hoveredInfo.code) }} {{ hoveredInfo.name }}</strong>
          <span v-if="hoveredInfo.count">{{ formatNumber(hoveredInfo.count) }} visitors · {{ hoveredInfo.share }}%</span>
          <span v-else class="cfa-muted">No visitors</span>
          <span v-if="canFilterHovered" class="cfa-world-tip-hint">Click to filter</span>
        </div>
        <button v-if="region" type="button" class="cfa-btn cfa-btn-sm cfa-world-out" @click="zoomTo(null)">← World</button>
      </div>
      <ol v-if="top.length" class="cfa-world-top" aria-label="Top countries, click to filter">
        <li
          v-for="[code, count] in top"
          :key="code"
          :class="{ active: hovered === code }"
          @mouseenter="setHover(code)"
          @mouseleave="setHover(null)"
          @click="filterBy(code)"
        >
          <span class="cfa-world-flag">{{ flagEmoji(code) }}</span>
          <span class="cfa-world-name cfa-truncate">{{ countryName(code) }}</span>
          <span class="cfa-num">{{ formatNumber(count) }}</span>
          <span class="cfa-world-bar"><span :style="{ width: `${Math.max(3, (count / topMax) * 100)}%` }" /></span>
        </li>
      </ol>
    </div>
    <p class="cfa-small cfa-muted cfa-world-foot">
      {{ region ? "Click a highlighted country to filter by it. Click elsewhere or press Esc to zoom out." : "Click a continent to zoom in." }}
      <template v-if="offMap">{{ offMap }} more {{ offMap === 1 ? "territory is" : "territories are" }} too small to draw; see Countries below.</template>
    </p>
  </section>
</template>

<style>
.cfa-world { margin-bottom: 16px; padding: 20px 20px 16px; background: radial-gradient(120% 90% at 50% 0%, var(--cfa-accent-soft), transparent 55%), var(--cfa-surface); }
.cfa-world-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 10px; }
.cfa-world-head h2 { margin: 0 0 2px; font-size: 17px; }
.cfa-world-head p { margin: 0; }
.cfa-world-legend { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
.cfa-world-scale { width: 64px; height: 6px; border-radius: 999px; background: linear-gradient(90deg, color-mix(in srgb, var(--cfa-accent) 35%, transparent), var(--cfa-accent)); }
.cfa-world-regions { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
.cfa-world-region { appearance: none; border: 1px solid transparent; background: none; color: var(--cfa-muted); font: inherit; font-size: 12.5px; padding: 3px 10px; border-radius: 999px; cursor: pointer; }
.cfa-world-region:hover { color: var(--cfa-text); background: var(--cfa-surface-2); }
.cfa-world-region[aria-pressed="true"] { color: var(--cfa-text); border-color: var(--cfa-border); background: var(--cfa-surface); font-weight: 600; }
/* Centered: the map never grows past 1040px, and the pair sits in the middle. */
.cfa-world-body { display: flex; justify-content: center; align-items: center; gap: 28px; }
.cfa-world-map { position: relative; flex: 1 1 0; min-width: 0; max-width: 1040px; }
.cfa-world-map canvas { display: block; width: 100%; }
.cfa-world-tip { position: absolute; transform: translate(-50%, calc(-100% - 12px)); pointer-events: none; background: var(--cfa-text); color: var(--cfa-surface); border-radius: 8px; padding: 6px 10px; font-size: 12.5px; line-height: 1.35; white-space: nowrap; display: flex; flex-direction: column; box-shadow: 0 8px 24px -10px rgba(15, 23, 42, 0.5); z-index: 2; }
.cfa-world-tip .cfa-muted { color: inherit; opacity: 0.7; }
.cfa-world-tip-hint { opacity: 0.7; font-size: 11.5px; }
.cfa-world-out { position: absolute; left: 8px; top: 8px; z-index: 1; box-shadow: 0 4px 14px -8px rgba(15, 23, 42, 0.5); }
.cfa-world-top { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; flex: 0 0 230px; min-width: 0; }
.cfa-world-top li { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; column-gap: 8px; row-gap: 4px; align-items: center; padding: 7px 8px; border-radius: 8px; cursor: pointer; }
.cfa-world-top li:hover, .cfa-world-top li.active { background: var(--cfa-accent-soft); }
.cfa-world-flag { font-size: 16px; }
.cfa-world-name { font-weight: 500; }
.cfa-world-bar { grid-column: 1 / -1; height: 3px; border-radius: 999px; background: var(--cfa-surface-2); overflow: hidden; }
.cfa-world-bar span { display: block; height: 100%; border-radius: 999px; background: var(--cfa-accent); }
.cfa-world-foot { margin: 10px 0 0; text-align: center; }
@media (max-width: 860px) {
  .cfa-world-body { flex-direction: column; align-items: stretch; gap: 12px; }
  .cfa-world-map { flex: none; }
  .cfa-world-top { flex: none; flex-direction: row; flex-wrap: wrap; }
  .cfa-world-top li { flex: 1 1 150px; }
}
</style>
