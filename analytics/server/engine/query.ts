/**
 * Read side: date ranges, KPIs + series, top-N metrics, realtime.
 * Unfiltered day ranges read stored rollups; filtered or sub-day ranges scan
 * raw events (bounded by `analytics_max_scan_days`).
 */
import type { EngineConfig } from "./config";
import { couch } from "./couch";
import { importId, rollupId, SCAN_MARGIN_MS } from "./aggregator";
import { buildVisits, computeRollups, mergeRollups, type MergedRollup } from "./rollup";
import { mainDb, readRawEvents } from "./storage";
import { addDays, dayEnd, dayStart, daysInRange, formatDay, localDay, localParts, normalizeDayInput } from "./time";
import { ALL_DIMENSIONS, type DayRollup, type DimEntry, type Dimension, type Filter, type SiteDoc, type Totals } from "./types";

export type Grain = "hour" | "day" | "month";

export interface ResolvedRange {
  preset: string;
  from: string;
  to: string;
  fromTs: number;
  toTs: number;
  grain: Grain;
  /** Sub-day window (24h preset) that must be answered from raw events. */
  window: [number, number] | null;
}

export class QueryError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

const PRESETS = ["today", "yesterday", "24h", "7d", "30d", "90d", "12m", "this_month", "last_month", "this_year", "custom"];

const chooseGrain = (from: string, to: string, requested?: unknown): Grain => {
  const days = daysInRange(from, to).length;
  if (requested === "hour" && days <= 7) return "hour";
  if (requested === "day" && days <= 400) return "day";
  if (requested === "month") return "month";
  if (days <= 2) return "hour";
  if (days > 92) return "month";
  return "day";
};

/** Resolves a range preset or custom `from`/`to` in the site's timezone. */
export const resolveRange = (
  query: Record<string, any>,
  timeZone: string,
  now = Date.now(),
): ResolvedRange => {
  const preset = PRESETS.includes(query.range) ? String(query.range) : query.from ? "custom" : "7d";
  const today = localDay(now, timeZone);
  const p = localParts(now, timeZone);
  const monthStart = `${p.year}${String(p.month).padStart(2, "0")}01`;
  let from = today;
  let to = today;
  let window: [number, number] | null = null;
  switch (preset) {
    case "yesterday":
      from = to = addDays(today, -1);
      break;
    case "24h":
      from = addDays(today, -1);
      window = [now - 24 * 3600_000, now + 1];
      break;
    case "7d":
      from = addDays(today, -6);
      break;
    case "30d":
      from = addDays(today, -29);
      break;
    case "90d":
      from = addDays(today, -89);
      break;
    case "12m":
      from = addDays(today, -364);
      break;
    case "this_month":
      from = monthStart;
      break;
    case "last_month": {
      to = addDays(monthStart, -1);
      from = `${to.slice(0, 6)}01`;
      break;
    }
    case "this_year":
      from = `${p.year}0101`;
      break;
    case "custom": {
      const f = normalizeDayInput(query.from);
      const t = normalizeDayInput(query.to) ?? f;
      if (!f || !t) throw new QueryError(400, "Invalid from/to (expected YYYY-MM-DD)");
      from = f <= t ? f : t;
      to = f <= t ? t : f;
      if (daysInRange(from, to, 5000).length > 3700) throw new QueryError(400, "Range too large");
      break;
    }
    default:
      break;
  }
  return {
    preset,
    from,
    to,
    fromTs: window ? window[0] : dayStart(from, timeZone),
    toTs: window ? window[1] : dayEnd(to, timeZone),
    grain: window ? "hour" : chooseGrain(from, to, query.grain),
    window,
  };
};

/** Same-length range immediately before `range`. */
export const previousRange = (range: ResolvedRange, timeZone: string): ResolvedRange => {
  if (range.window) {
    const span = range.window[1] - range.window[0];
    const window: [number, number] = [range.window[0] - span, range.window[0]];
    return { ...range, preset: "previous", from: addDays(range.from, -1), to: addDays(range.to, -1), fromTs: window[0], toTs: window[1], window };
  }
  const length = daysInRange(range.from, range.to, 5000).length;
  const to = addDays(range.from, -1);
  const from = addDays(to, -(length - 1));
  return { ...range, preset: "previous", from, to, fromTs: dayStart(from, timeZone), toTs: dayEnd(to, timeZone), window: null };
};

const FILTER_OPS = new Set(["eq", "neq", "contains", "not_contains"]);

/** Parses `filters` (JSON array or `dim:op:value` list). Unknown dims are dropped. */
export const parseFilters = (raw: unknown): Filter[] => {
  if (!raw) return [];
  let list: any[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      list = Array.isArray(parsed) ? parsed : [];
    } catch {
      list = [];
    }
  }
  return list
    .filter((f) => f && ALL_DIMENSIONS.includes(f.dim) && typeof f.value === "string")
    .slice(0, 10)
    .map((f) => ({ dim: f.dim, op: FILTER_OPS.has(f.op) ? f.op : "eq", value: f.value.slice(0, 300) }));
};

/** Reads stored rollups (and imported rollups) for a list of days. */
export const readStoredRollups = async (config: EngineConfig, site: SiteDoc, days: string[]): Promise<DayRollup[]> => {
  if (!days.length) return [];
  const keys = days.flatMap((day) => [rollupId(site.id, day), importId(site.id, day)]);
  const rollups: DayRollup[] = [];
  for (let i = 0; i < keys.length; i += 1000) {
    const result: any = await couch(`${mainDb(config)}/_all_docs`, {
      method: "POST",
      body: JSON.stringify({ keys: keys.slice(i, i + 1000), include_docs: true }),
    }, { allow404: true });
    for (const row of result?.rows ?? []) if (row.doc) rollups.push(row.doc as DayRollup);
  }
  return rollups;
};

/** Raw-scan rollups for a range (bounded). */
export const computeRawRollups = async (
  config: EngineConfig,
  site: SiteDoc,
  range: ResolvedRange,
  filters: Filter[],
): Promise<DayRollup[]> => {
  const days = daysInRange(range.from, range.to, 5000);
  if (days.length > config.maxScanDays) {
    throw new QueryError(400, `Filtered queries are limited to ${config.maxScanDays} days (analytics_max_scan_days)`);
  }
  const events = await readRawEvents(config, site.id, range.fromTs - SCAN_MARGIN_MS, range.toTs + SCAN_MARGIN_MS);
  return [...computeRollups(events, {
    timeZone: site.timezone,
    filters,
    days: new Set(days),
    window: range.window ?? undefined,
  }).values()];
};

/** Rollups for a range: stored when possible, raw otherwise. */
export const rollupsForRange = async (
  config: EngineConfig,
  site: SiteDoc,
  range: ResolvedRange,
  filters: Filter[],
): Promise<DayRollup[]> => {
  if (filters.length || range.window) return computeRawRollups(config, site, range, filters);
  return readStoredRollups(config, site, daysInRange(range.from, range.to, 5000));
};

export interface SeriesPoint {
  t: string;
  pageviews: number;
  visitors: number;
  visits: number;
}

/** Builds a zero-filled time series at the requested grain. */
export const buildSeries = (rollups: DayRollup[], range: ResolvedRange, timeZone: string): SeriesPoint[] => {
  const points = new Map<string, SeriesPoint>();
  const ensure = (t: string) => {
    let point = points.get(t);
    if (!point) {
      point = { t, pageviews: 0, visitors: 0, visits: 0 };
      points.set(t, point);
    }
    return point;
  };
  const days = daysInRange(range.from, range.to, 5000);
  if (range.grain === "hour") {
    for (const day of days) {
      for (let h = 0; h < 24; h += 1) {
        const t = `${formatDay(day)}T${String(h).padStart(2, "0")}:00`;
        if (range.window) {
          const ts = dayStart(day, timeZone) + h * 3600_000;
          if (ts + 3600_000 <= range.window[0] || ts >= range.window[1]) continue;
        }
        ensure(t);
      }
    }
  } else if (range.grain === "month") {
    for (const day of days) ensure(`${day.slice(0, 4)}-${day.slice(4, 6)}`);
  } else {
    for (const day of days) ensure(formatDay(day));
  }
  for (const rollup of rollups) {
    if (range.grain === "hour") {
      (rollup.hours ?? []).forEach((hour, h) => {
        const point = points.get(`${formatDay(rollup.day)}T${String(h).padStart(2, "0")}:00`);
        if (!point) return;
        point.pageviews += hour.pv;
        point.visitors += hour.v;
        point.visits += hour.vi;
      });
    } else {
      const key = range.grain === "month" ? `${rollup.day.slice(0, 4)}-${rollup.day.slice(4, 6)}` : formatDay(rollup.day);
      const point = points.get(key);
      if (!point) continue;
      point.pageviews += rollup.totals.pageviews;
      point.visitors += rollup.totals.visitors;
      point.visits += rollup.totals.visits;
    }
  }
  return [...points.values()];
};

export interface OverviewResult {
  range: { preset: string; from: string; to: string; grain: Grain };
  totals: Totals & { bounceRate: number; avgDuration: number; viewsPerVisit: number };
  series: SeriesPoint[];
  revenue: Record<string, number>;
  previous?: { totals: OverviewResult["totals"]; series: SeriesPoint[] };
}

export const decorateTotals = (totals: Totals) => ({
  ...totals,
  bounceRate: totals.visits ? Math.round((totals.bounces / totals.visits) * 1000) / 10 : 0,
  avgDuration: totals.visits ? Math.round(totals.duration / totals.visits) : 0,
  viewsPerVisit: totals.visits ? Math.round((totals.pageviews / totals.visits) * 100) / 100 : 0,
});

/** KPIs and time series (optionally compared with the previous period). */
export const getOverview = async (
  config: EngineConfig,
  site: SiteDoc,
  query: Record<string, any>,
): Promise<OverviewResult> => {
  const range = resolveRange(query, site.timezone);
  const filters = parseFilters(query.filters);
  const rollups = await rollupsForRange(config, site, range, filters);
  const merged = mergeRollups(rollups, new Set());
  const result: OverviewResult = {
    range: { preset: range.preset, from: formatDay(range.from), to: formatDay(range.to), grain: range.grain },
    totals: decorateTotals(merged.totals),
    series: buildSeries(rollups, range, site.timezone),
    revenue: merged.revenue,
  };
  if (query.compare === "1" || query.compare === "true" || query.compare === true) {
    const prev = previousRange(range, site.timezone);
    const prevRollups = await rollupsForRange(config, site, prev, filters);
    result.previous = {
      totals: decorateTotals(mergeRollups(prevRollups, new Set()).totals),
      series: buildSeries(prevRollups, prev, site.timezone),
    };
  }
  return result;
};

export interface MetricRow extends DimEntry {
  value: string;
  bounceRate?: number;
  avgDuration?: number;
}

const rowSort = (a: MetricRow, b: MetricRow) =>
  (b.v ?? 0) - (a.v ?? 0) || (b.pv ?? 0) - (a.pv ?? 0) || (b.c ?? 0) - (a.c ?? 0) || a.value.localeCompare(b.value);

/** Converts a merged dimension map into sorted rows. */
export const toRows = (map: Record<string, DimEntry> | undefined, search?: string): MetricRow[] => {
  const needle = search?.toLowerCase();
  return Object.entries(map ?? {})
    .filter(([value]) => !needle || value.toLowerCase().includes(needle))
    .map(([value, entry]) => ({
      value,
      ...entry,
      ...(entry.vi ? { bounceRate: Math.round(((entry.b ?? 0) / entry.vi) * 1000) / 10, avgDuration: Math.round((entry.d ?? 0) / entry.vi) } : {}),
    }))
    .sort(rowSort);
};

/** Top-N rows for one dimension. */
export const getMetrics = async (
  config: EngineConfig,
  site: SiteDoc,
  dim: string,
  query: Record<string, any>,
) => {
  if (!ALL_DIMENSIONS.includes(dim as Dimension)) throw new QueryError(400, `Unknown dimension: ${dim}`);
  const range = resolveRange(query, site.timezone);
  const filters = parseFilters(query.filters);
  const merged: MergedRollup = mergeRollups(await rollupsForRange(config, site, range, filters), new Set([dim]));
  let rows = toRows(merged.dims[dim], typeof query.search === "string" ? query.search : undefined);
  if (dim === "prop" && typeof query.event === "string") {
    rows = rows.filter((row) => row.value.startsWith(`${query.event}\u001f`));
  }
  const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 500);
  const offset = Math.max(Number(query.offset) || 0, 0);
  return {
    dim,
    total: rows.length,
    totals: decorateTotals(merged.totals),
    rows: rows.slice(offset, offset + limit),
  };
};

/** Live view of the last 30 minutes, straight from raw events. */
export const getRealtime = async (config: EngineConfig, site: SiteDoc, now = Date.now()) => {
  const windowMs = 30 * 60_000;
  const events = await readRawEvents(config, site.id, now - windowMs, now + 1);
  const visitors = new Set<string>();
  const activeVisitors = new Set<string>();
  const minutes = Array.from({ length: 30 }, (_, i) => ({ t: now - (29 - i) * 60_000, pageviews: 0, visitors: new Set<string>() }));
  const count = (map: Map<string, Set<string>>, key: string | null | undefined, visitor: string) => {
    if (!key) return;
    const set = map.get(key) ?? new Set<string>();
    set.add(visitor);
    map.set(key, set);
  };
  const pages = new Map<string, Set<string>>();
  const referrers = new Map<string, Set<string>>();
  const countries = new Map<string, Set<string>>();
  let pageviews = 0;
  let customEvents = 0;
  for (const event of events) {
    if (event.t === "id") continue;
    visitors.add(event.v);
    if (now - event.ts <= 5 * 60_000) activeVisitors.add(event.v);
    const bucket = minutes[Math.min(29, Math.max(0, 29 - Math.floor((now - event.ts) / 60_000)))];
    bucket.visitors.add(event.v);
    if (event.t === "pv") {
      pageviews += 1;
      bucket.pageviews += 1;
      count(pages, event.p, event.v);
    } else {
      customEvents += 1;
    }
  }
  for (const visit of buildVisits(events)) {
    count(referrers, visit.first.r ?? "(direct)", visit.visitor);
    count(countries, visit.first.cc ?? "(unknown)", visit.visitor);
  }
  const top = (map: Map<string, Set<string>>) =>
    [...map].map(([value, set]) => ({ value, v: set.size })).sort((a, b) => b.v - a.v).slice(0, 10);
  return {
    now,
    activeVisitors: activeVisitors.size,
    visitors: visitors.size,
    pageviews,
    events: customEvents,
    series: minutes.map((m) => ({ t: new Date(m.t).toISOString(), pageviews: m.pageviews, visitors: m.visitors.size })),
    pages: top(pages),
    referrers: top(referrers),
    countries: top(countries),
    recent: events
      .filter((e) => e.t !== "id")
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 50)
      .map((e) => ({ ts: e.ts, type: e.t, path: e.p, name: e.n ?? null, country: e.cc ?? null, browser: e.br, device: e.dv, referrer: e.r ?? null })),
  };
};
