/**
 * Pure aggregation: raw events -> visits -> per-day rollups. Used by the
 * aggregator (unfiltered, stored) and by filtered queries (on the fly).
 */
import { localDay, localHour } from "./time";
import type { DayRollup, DimEntry, Filter, HourBucket, RawEvent, Totals } from "./types";

export const VISIT_GAP_MS = 30 * 60 * 1000;
export const DIM_CAP = 500;
export const OTHER = "(other)";

export interface Visit {
  id: string;
  visitor: string;
  start: number;
  end: number;
  events: RawEvent[];
  pageviews: RawEvent[];
  customs: RawEvent[];
  first: RawEvent;
}

/** Groups events by visitor and splits them into visits on 30-minute gaps. */
export const buildVisits = (events: RawEvent[]): Visit[] => {
  const byVisitor = new Map<string, RawEvent[]>();
  for (const event of events) {
    if (!event || typeof event.ts !== "number" || !event.v) continue;
    const list = byVisitor.get(event.v);
    if (list) list.push(event);
    else byVisitor.set(event.v, [event]);
  }
  const visits: Visit[] = [];
  for (const [visitor, list] of byVisitor) {
    list.sort((a, b) => a.ts - b.ts || (a._id < b._id ? -1 : 1));
    let current: RawEvent[] = [];
    const close = () => {
      if (!current.length) return;
      const tracked = current.filter((e) => e.t !== "id");
      if (tracked.length) {
        visits.push({
          id: `${visitor}-${current[0].ts.toString(36)}`,
          visitor,
          start: current[0].ts,
          end: current[current.length - 1].ts,
          events: current,
          pageviews: tracked.filter((e) => e.t === "pv"),
          customs: tracked.filter((e) => e.t === "ev"),
          first: tracked[0],
        });
      }
      current = [];
    };
    for (const event of list) {
      if (current.length && event.ts - current[current.length - 1].ts > VISIT_GAP_MS) close();
      current.push(event);
    }
    close();
  }
  return visits.sort((a, b) => a.start - b.start);
};

/** Visit-level attribute for a dimension (null = not applicable). */
export const visitAttribute = (visit: Visit, dim: string): string | null => {
  const f = visit.first;
  switch (dim) {
    case "referrer":
      return f.r ?? null;
    case "referrer_domain":
      return f.rd ?? null;
    case "channel":
      return f.ch ?? "direct";
    case "utm_source":
      return f.utm?.s ?? null;
    case "utm_medium":
      return f.utm?.m ?? null;
    case "utm_campaign":
      return f.utm?.c ?? null;
    case "utm_term":
      return f.utm?.t ?? null;
    case "utm_content":
      return f.utm?.ct ?? null;
    case "browser":
      return f.br ?? null;
    case "os":
      return f.os ?? null;
    case "device":
      return f.dv ?? null;
    case "screen":
      return f.sc ?? null;
    case "language":
      return f.lg ?? null;
    case "country":
      return f.cc ?? null;
    case "region":
      return f.cc && f.rg ? `${f.cc}-${f.rg}` : null;
    case "city":
      return f.cc && f.ci ? `${f.ci}, ${f.cc}` : null;
    case "tag":
      return visit.events.find((e) => e.tg)?.tg ?? null;
    case "entry":
      return visit.pageviews[0]?.p ?? null;
    case "exit":
      return visit.pageviews[visit.pageviews.length - 1]?.p ?? null;
    default:
      return null;
  }
};

const PAGE_ATTR: Record<string, (e: RawEvent) => string | null | undefined> = {
  page: (e) => e.p,
  title: (e) => e.ti,
  host: (e) => e.h,
};

export const isPageDimension = (dim: string) => dim in PAGE_ATTR;

const matches = (actual: string | null | undefined, filter: Filter): boolean => {
  const value = (actual ?? "").toLowerCase();
  const wanted = filter.value.toLowerCase();
  switch (filter.op) {
    case "neq":
      return value !== wanted;
    case "contains":
      return value.includes(wanted);
    case "not_contains":
      return !value.includes(wanted);
    default:
      return value === wanted;
  }
};

interface FilteredVisit {
  visit: Visit;
  pageviews: RawEvent[];
  customs: RawEvent[];
}

/** Applies filters; returns null when the visit is excluded. */
export const filterVisit = (visit: Visit, filters: Filter[]): FilteredVisit | null => {
  let pageviews = visit.pageviews;
  let customs = visit.customs;
  for (const filter of filters) {
    if (isPageDimension(filter.dim)) {
      pageviews = pageviews.filter((e) => matches(PAGE_ATTR[filter.dim](e), filter));
      if (!pageviews.length) return null;
    } else if (filter.dim === "event") {
      customs = customs.filter((e) => matches(e.n, filter));
      if (!customs.length) return null;
    } else if (filter.dim === "prop") {
      const [key, ...rest] = filter.value.split("=");
      const propFilter = { ...filter, value: rest.join("=") };
      customs = customs.filter((e) => e.d && key in e.d && matches(String(e.d[key]), propFilter));
      if (!customs.length) return null;
    } else if (!matches(visitAttribute(visit, filter.dim), filter)) {
      return null;
    }
  }
  return { visit, pageviews, customs };
};

interface DimAccumulator {
  pv: number;
  vi: number;
  b: number;
  d: number;
  c: number;
  visitors: Set<string>;
}

interface DayAccumulator {
  totals: Totals;
  visitors: Set<string>;
  hours: Array<{ pv: number; vi: number; visitors: Set<string> }>;
  dims: Map<string, Map<string, DimAccumulator>>;
  revenue: Map<string, number>;
}

const newDay = (): DayAccumulator => ({
  totals: { visitors: 0, visits: 0, pageviews: 0, bounces: 0, duration: 0, events: 0 },
  visitors: new Set(),
  hours: Array.from({ length: 24 }, () => ({ pv: 0, vi: 0, visitors: new Set<string>() })),
  dims: new Map(),
  revenue: new Map(),
});

const dimEntry = (day: DayAccumulator, dim: string, value: string): DimAccumulator => {
  let map = day.dims.get(dim);
  if (!map) {
    map = new Map();
    day.dims.set(dim, map);
  }
  let entry = map.get(value);
  if (!entry) {
    entry = { pv: 0, vi: 0, b: 0, d: 0, c: 0, visitors: new Set() };
    map.set(value, entry);
  }
  return entry;
};

const VISIT_DIMS = [
  "referrer", "referrer_domain", "channel", "utm_source", "utm_medium", "utm_campaign",
  "utm_term", "utm_content", "browser", "os", "device", "screen", "language", "country",
  "region", "city", "tag", "entry", "exit",
];

/** True when a whole visit counts as a bounce: one pageview, no custom events. */
export const isBounce = (visit: Visit): boolean =>
  visit.pageviews.length <= 1 && visit.customs.length === 0;

/** Visit duration in whole seconds. */
export const visitDuration = (visit: Visit): number => Math.round((visit.end - visit.start) / 1000);

const parseRevenue = (event: RawEvent): { amount: number; currency: string } | null => {
  const raw = event.d?.revenue;
  const amount = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(amount)) return null;
  const currency = String(event.d?.currency ?? "USD").toUpperCase().slice(0, 3) || "USD";
  return { amount, currency };
};

export interface ComputeOptions {
  timeZone: string;
  filters?: Filter[];
  /** Only visits starting on these local days are counted. */
  days?: Set<string>;
  /** Only visits starting in `[from, to)` are counted. */
  window?: [number, number];
  cap?: number;
}

/** Computes per-day rollups for visits matching the options. */
export const computeRollups = (events: RawEvent[], options: ComputeOptions): Map<string, DayRollup> => {
  const { timeZone, filters = [], days, window } = options;
  const accumulators = new Map<string, DayAccumulator>();

  for (const visit of buildVisits(events)) {
    if (window && (visit.start < window[0] || visit.start >= window[1])) continue;
    const day = localDay(visit.start, timeZone);
    if (days && !days.has(day)) continue;
    const filtered = filterVisit(visit, filters);
    if (!filtered) continue;

    let acc = accumulators.get(day);
    if (!acc) {
      acc = newDay();
      accumulators.set(day, acc);
    }
    const bounce = isBounce(visit) ? 1 : 0;
    const duration = visitDuration(visit);
    const pvCount = filtered.pageviews.length;

    acc.totals.visits += 1;
    acc.totals.pageviews += pvCount;
    acc.totals.bounces += bounce;
    acc.totals.duration += duration;
    acc.totals.events += filtered.customs.length;
    acc.visitors.add(visit.visitor);
    acc.hours[localHour(visit.start, timeZone)].vi += 1;

    for (const pv of filtered.pageviews) {
      const hour = acc.hours[localHour(pv.ts, timeZone)];
      hour.pv += 1;
      hour.visitors.add(visit.visitor);
      for (const dim of ["page", "title", "host"]) {
        const value = PAGE_ATTR[dim](pv);
        if (!value) continue;
        const entry = dimEntry(acc, dim, value);
        entry.pv += 1;
        entry.visitors.add(visit.visitor);
      }
    }
    if (!filtered.pageviews.length) {
      acc.hours[localHour(visit.start, timeZone)].visitors.add(visit.visitor);
    }

    for (const dim of VISIT_DIMS) {
      const value = visitAttribute(visit, dim);
      if (!value) continue;
      const entry = dimEntry(acc, dim, value);
      entry.vi += 1;
      entry.pv += pvCount;
      entry.b += bounce;
      entry.d += duration;
      entry.visitors.add(visit.visitor);
    }

    for (const custom of filtered.customs) {
      if (!custom.n) continue;
      const entry = dimEntry(acc, "event", custom.n);
      entry.c += 1;
      entry.visitors.add(visit.visitor);
      for (const [key, value] of Object.entries(custom.d ?? {})) {
        const prop = dimEntry(acc, "prop", `${custom.n}\u001f${key}\u001f${String(value).slice(0, 100)}`);
        prop.c += 1;
        prop.visitors.add(visit.visitor);
      }
      const revenue = parseRevenue(custom);
      if (revenue) acc.revenue.set(revenue.currency, (acc.revenue.get(revenue.currency) ?? 0) + revenue.amount);
    }
  }

  const result = new Map<string, DayRollup>();
  for (const [day, acc] of accumulators) {
    result.set(day, finalizeDay(day, acc, options.cap ?? DIM_CAP));
  }
  return result;
};

const sortKey = (entry: DimEntry) => (entry.v ?? 0) * 1e6 + (entry.pv ?? 0) + (entry.c ?? 0) + (entry.vi ?? 0);

const compactEntry = (entry: DimAccumulator | DimEntry & { visitors?: Set<string> }): DimEntry => {
  const out: DimEntry = {};
  const v = "visitors" in entry && entry.visitors instanceof Set ? entry.visitors.size : (entry as DimEntry).v;
  if (v) out.v = v;
  for (const key of ["pv", "vi", "b", "d", "c"] as const) {
    const value = (entry as any)[key];
    if (value) out[key] = Math.round(value * 100) / 100;
  }
  return out;
};

/** Keeps the top `cap` values, folding the rest into `(other)`. */
export const capDimension = (map: Record<string, DimEntry>, cap = DIM_CAP): Record<string, DimEntry> => {
  const entries = Object.entries(map);
  if (entries.length <= cap) return map;
  entries.sort((a, b) => sortKey(b[1]) - sortKey(a[1]));
  const kept = Object.fromEntries(entries.slice(0, cap - 1));
  const other: DimEntry = { ...(kept[OTHER] ?? {}) };
  for (const [, entry] of entries.slice(cap - 1)) addEntry(other, entry);
  kept[OTHER] = other;
  return kept;
};

const finalizeDay = (day: string, acc: DayAccumulator, cap: number): DayRollup => {
  const dims: DayRollup["dims"] = {};
  for (const [dim, map] of acc.dims) {
    const plain: Record<string, DimEntry> = {};
    for (const [value, entry] of map) plain[value] = compactEntry(entry);
    dims[dim] = capDimension(plain, cap);
  }
  return {
    day,
    totals: { ...acc.totals, visitors: acc.visitors.size },
    hours: acc.hours.map((h): HourBucket => ({ pv: h.pv, v: h.visitors.size, vi: h.vi })),
    dims,
    revenue: Object.fromEntries([...acc.revenue].map(([k, v]) => [k, Math.round(v * 100) / 100])),
  };
};

/** Adds `source` metrics into `target` in place. */
export const addEntry = (target: DimEntry, source: DimEntry): DimEntry => {
  for (const key of ["pv", "v", "vi", "b", "d", "c"] as const) {
    if (source[key]) target[key] = Math.round(((target[key] ?? 0) + (source[key] ?? 0)) * 100) / 100;
  }
  return target;
};

export const emptyTotals = (): Totals => ({ visitors: 0, visits: 0, pageviews: 0, bounces: 0, duration: 0, events: 0 });

export interface MergedRollup {
  totals: Totals;
  dims: Record<string, Record<string, DimEntry>>;
  revenue: Record<string, number>;
}

/** Sums several day rollups (visitors = sum of daily uniques). */
export const mergeRollups = (rollups: Array<Pick<DayRollup, "totals" | "dims" | "revenue">>, dimsWanted?: Set<string>): MergedRollup => {
  const merged: MergedRollup = { totals: emptyTotals(), dims: {}, revenue: {} };
  for (const rollup of rollups) {
    for (const key of Object.keys(merged.totals) as Array<keyof Totals>) {
      merged.totals[key] += rollup.totals?.[key] ?? 0;
    }
    for (const [dim, map] of Object.entries(rollup.dims ?? {})) {
      if (dimsWanted && !dimsWanted.has(dim)) continue;
      const target = (merged.dims[dim] ??= {});
      for (const [value, entry] of Object.entries(map)) addEntry((target[value] ??= {}), entry);
    }
    for (const [currency, amount] of Object.entries(rollup.revenue ?? {})) {
      merged.revenue[currency] = Math.round(((merged.revenue[currency] ?? 0) + amount) * 100) / 100;
    }
  }
  return merged;
};
