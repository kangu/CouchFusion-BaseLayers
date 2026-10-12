<script setup lang="ts">
/**
 * Root wrapper for analytics admin views: title bar + shared design tokens.
 * Styles are plain CSS scoped under `.cfa` so they work without Tailwind.
 */
// props
defineProps<{
  title: string;
  subtitle?: string;
}>();
</script>

<template>
  <div class="cfa">
    <header class="cfa-head">
      <div>
        <h1 class="cfa-title">{{ title }}</h1>
        <p v-if="subtitle" class="cfa-subtitle">{{ subtitle }}</p>
      </div>
      <div class="cfa-head-actions"><slot name="actions" /></div>
    </header>
    <slot />
  </div>
</template>

<style>
/*
 * Tokens follow the admin workspace (light, gray borders, orange accent).
 * Dark mode is opt-in from the workspace itself: add a `dark` class or
 * `data-theme="dark"` on any ancestor (e.g. via adminWorkspace.themeClass).
 */
.cfa {
  --cfa-bg: transparent;
  --cfa-page: #f9fafb;
  --cfa-surface: #ffffff;
  --cfa-surface-2: #f3f4f6;
  --cfa-border: #e5e7eb;
  --cfa-text: #111827;
  --cfa-muted: #6b7280;
  --cfa-accent: #f97316;
  --cfa-accent-soft: rgba(249, 115, 22, 0.1);
  --cfa-good: #16a34a;
  --cfa-bad: #dc2626;
  --cfa-bar: rgba(249, 115, 22, 0.12);
  --cfa-chart-1: #f97316;
  --cfa-chart-2: #64748b;
  --cfa-chart-3: #cbd5e1;
  --cfa-chart-grid: #e5e7eb;
  --cfa-map-land: #d9dee5;
  --cfa-map-glow: rgba(249, 115, 22, 0.45);
  --cfa-radius: 12px;
  color-scheme: light;
  accent-color: var(--cfa-accent);
  color: var(--cfa-text);
  background: var(--cfa-bg);
  font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  padding: 24px 16px 48px;
  max-width: 1280px;
  margin: 0 auto;
  box-sizing: border-box;
}
.dark .cfa, [data-theme="dark"] .cfa, .cfa.cfa-dark {
  color-scheme: dark;
  --cfa-page: #111827;
  --cfa-surface: #1f2937;
  --cfa-surface-2: #273244;
  --cfa-border: #374151;
  --cfa-text: #f3f4f6;
  --cfa-muted: #9ca3af;
  --cfa-accent: #fb923c;
  --cfa-accent-soft: rgba(251, 146, 60, 0.16);
  --cfa-good: #4ade80;
  --cfa-bad: #f87171;
  --cfa-bar: rgba(251, 146, 60, 0.16);
  --cfa-chart-1: #fb923c;
  --cfa-chart-2: #94a3b8;
  --cfa-chart-3: #475569;
  --cfa-chart-grid: #374151;
  --cfa-map-land: #3b4658;
  --cfa-map-glow: rgba(251, 146, 60, 0.5);
}
.cfa *, .cfa *::before, .cfa *::after { box-sizing: border-box; }
.cfa-head { display: flex; flex-wrap: wrap; gap: 12px; justify-content: space-between; align-items: flex-end; margin-bottom: 16px; }
.cfa-title { font-size: 22px; font-weight: 650; margin: 0; letter-spacing: -0.01em; }
.cfa-subtitle { margin: 2px 0 0; color: var(--cfa-muted); }
.cfa-head-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.cfa-card { background: var(--cfa-surface); border: 1px solid var(--cfa-border); border-radius: var(--cfa-radius); padding: 16px; min-width: 0; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); }
.cfa-card h2, .cfa-card h3 { margin: 0 0 10px; font-size: 15px; font-weight: 600; }
.cfa-grid { display: grid; gap: 16px; }
.cfa-grid-2 { grid-template-columns: repeat(auto-fit, minmax(min(100%, 440px), 1fr)); }
.cfa-grid-3 { grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); }
.cfa-stack { display: flex; flex-direction: column; gap: 16px; }
.cfa-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.cfa-muted { color: var(--cfa-muted); }
.cfa-small { font-size: 12px; }
.cfa-btn { appearance: none; border: 1px solid var(--cfa-border); background: var(--cfa-surface); color: var(--cfa-text); border-radius: 8px; padding: 6px 12px; font: inherit; cursor: pointer; line-height: 1.3; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }
.cfa-btn:hover { background: var(--cfa-surface-2); }
.cfa-btn:disabled { opacity: 0.55; cursor: default; }
.cfa-btn-primary { background: var(--cfa-accent); border-color: var(--cfa-accent); color: #fff; font-weight: 500; }
.cfa-btn-primary:hover { background: var(--cfa-accent); filter: brightness(1.08); }
.cfa-btn-danger { color: var(--cfa-bad); border-color: var(--cfa-bad); }
.cfa-btn-sm { padding: 3px 8px; font-size: 12px; }
.cfa-input, .cfa-select, .cfa-textarea { border: 1px solid var(--cfa-border); background: var(--cfa-surface); color: var(--cfa-text); border-radius: 8px; padding: 6px 10px; font: inherit; min-width: 0; }
.cfa-textarea { width: 100%; min-height: 72px; resize: vertical; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; }
.cfa-field { display: flex; flex-direction: column; gap: 4px; }
.cfa-field > span { font-size: 12px; color: var(--cfa-muted); font-weight: 500; }
.cfa-check { display: inline-flex; gap: 6px; align-items: center; cursor: pointer; }
.cfa-tabs { display: flex; gap: 2px; flex-wrap: wrap; border-bottom: 1px solid var(--cfa-border); margin: -4px 0 8px; }
.cfa-tab { appearance: none; border: 0; background: none; color: var(--cfa-muted); padding: 6px 10px; font: inherit; font-size: 13px; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; }
.cfa-tab[aria-selected="true"] { color: var(--cfa-text); border-bottom-color: var(--cfa-accent); font-weight: 600; }
.cfa-table { width: 100%; border-collapse: collapse; }
.cfa-table th { text-align: left; font-size: 12px; font-weight: 500; color: var(--cfa-muted); padding: 6px 8px; border-bottom: 1px solid var(--cfa-border); }
.cfa-table td { padding: 6px 8px; border-bottom: 1px solid var(--cfa-border); vertical-align: top; }
.cfa-table tr:last-child td { border-bottom: 0; }
.cfa-num { text-align: right !important; font-variant-numeric: tabular-nums; white-space: nowrap; }
.cfa-error { color: var(--cfa-bad); background: color-mix(in srgb, var(--cfa-bad) 10%, transparent); border-radius: 8px; padding: 8px 12px; margin: 0 0 12px; }
.cfa-empty { color: var(--cfa-muted); padding: 20px 0; text-align: center; }
.cfa-chip { display: inline-flex; align-items: center; gap: 6px; background: var(--cfa-accent-soft); color: var(--cfa-text); border-radius: 999px; padding: 3px 4px 3px 10px; font-size: 12.5px; }
.cfa-chip button { border: 0; background: none; color: inherit; cursor: pointer; font-size: 14px; line-height: 1; padding: 0 4px; }
.cfa-code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; background: var(--cfa-surface-2); border-radius: 8px; padding: 10px 12px; white-space: pre-wrap; word-break: break-all; margin: 0; }
.cfa-badge { display: inline-block; font-size: 11px; padding: 1px 7px; border-radius: 999px; background: var(--cfa-surface-2); color: var(--cfa-muted); }
.cfa-truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cfa-scroll-x { overflow-x: auto; }
</style>
