/**
 * Data import: Fathom Lite aggregate CSVs (site_stats / page_stats /
 * referrer_stats, hourly rows with hostname/pathname resolved) ->
 * `imp:<site>:<day>` rollups that are merged into dashboards (raw-only
 * features such as filters and reports do not include them).
 */
import type { EngineConfig } from "./config";
import { upsertDoc } from "./couch";
import { importId } from "./aggregator";
import { parseCsv } from "./csv";
import { normalizePath } from "./hit";
import { parseReferrer } from "./referrer";
import { mainDb } from "./storage";
import { localDay, localHour } from "./time";
import type { DayRollup, SiteDoc } from "./types";

const MAX_ROWS = 500_000;

/** Converts CSV text into objects keyed by lower-cased header. */
export const csvObjects = (text: string): Record<string, string>[] => {
  const rows = parseCsv(text.replace(/^﻿/, ""));
  const header = (rows.shift() ?? []).map((h) => h.trim().toLowerCase());
  return rows.slice(0, MAX_ROWS).map((row) => Object.fromEntries(header.map((h, i) => [h, row[i] ?? ""])));
};

const pick = (row: Record<string, string>, ...keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== "" && value !== "NULL" && value !== "\\N") return value;
  }
  return null;
};

const parseTs = (value: string | null): number | null => {
  if (!value) return null;
  const normalized = /^\d{4}-\d{2}-\d{2} \d/.test(value) && !/[zZ+]/.test(value.slice(10)) ? `${value.replace(" ", "T")}Z` : value;
  const ts = Date.parse(normalized);
  return Number.isFinite(ts) ? ts : /^\d{10,13}$/.test(value) ? Number(value.padEnd(13, "0")) : null;
};

const num = (value: string | null) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const emptyDay = (day: string): DayRollup => ({
  day,
  totals: { visitors: 0, visits: 0, pageviews: 0, bounces: 0, duration: 0, events: 0 },
  hours: Array.from({ length: 24 }, () => ({ pv: 0, v: 0, vi: 0 })),
  dims: {},
  revenue: {},
});

/** Converts a Fathom bounce rate (0-1 or 0-100) to a fraction. */
const rate = (value: string | null) => {
  const n = num(value);
  return n > 1 ? n / 100 : n;
};

/** Builds per-day rollups from Fathom Lite aggregate CSV rows. Pure. */
export const fathomRowsToRollups = (
  site: SiteDoc,
  input: { siteStats?: Record<string, string>[]; pageStats?: Record<string, string>[]; referrerStats?: Record<string, string>[] },
): Map<string, DayRollup> => {
  const days = new Map<string, DayRollup>();
  const dayOf = (row: Record<string, string>) => {
    const ts = parseTs(pick(row, "ts", "date", "timestamp"));
    if (ts === null) return null;
    const day = localDay(ts, site.timezone);
    if (!days.has(day)) days.set(day, emptyDay(day));
    return { rollup: days.get(day)!, hour: localHour(ts, site.timezone) };
  };
  const addDim = (rollup: DayRollup, dim: string, value: string, metrics: Record<string, number>) => {
    const map = (rollup.dims[dim] ??= {});
    const entry: any = (map[value] ??= {});
    for (const [key, amount] of Object.entries(metrics)) if (amount) entry[key] = Math.round(((entry[key] ?? 0) + amount) * 100) / 100;
  };
  for (const row of input.siteStats ?? []) {
    const slot = dayOf(row);
    if (!slot) continue;
    const visits = num(pick(row, "sessions", "visits"));
    const pageviews = num(pick(row, "pageviews"));
    const visitors = num(pick(row, "visitors"));
    const t = slot.rollup.totals;
    t.pageviews += pageviews;
    t.visitors += visitors;
    t.visits += visits;
    t.bounces += Math.round(rate(pick(row, "bounce_rate")) * visits);
    t.duration += Math.round(num(pick(row, "avg_duration")) * visits);
    const hour = slot.rollup.hours[slot.hour];
    hour.pv += pageviews;
    hour.v += visitors;
    hour.vi += visits;
  }
  for (const row of input.pageStats ?? []) {
    const slot = dayOf(row);
    if (!slot) continue;
    const path = normalizePath(pick(row, "pathname", "path") ?? "/");
    const entries = num(pick(row, "entries"));
    addDim(slot.rollup, "page", path, { pv: num(pick(row, "pageviews")), v: num(pick(row, "visitors")) });
    if (entries) {
      addDim(slot.rollup, "entry", path, {
        vi: entries,
        v: entries,
        b: Math.round(rate(pick(row, "bounce_rate")) * entries),
        d: Math.round(num(pick(row, "avg_duration")) * entries),
      });
    }
    const host = pick(row, "hostname");
    if (host) addDim(slot.rollup, "host", host.replace(/^https?:\/\//, "").replace(/^www\./, ""), { pv: num(pick(row, "pageviews")), v: num(pick(row, "visitors")) });
  }
  for (const row of input.referrerStats ?? []) {
    const slot = dayOf(row);
    if (!slot) continue;
    const host = (pick(row, "hostname") ?? "").replace(/^https?:\/\//, "");
    const parsed = host ? parseReferrer(`https://${host}${pick(row, "pathname") ?? "/"}`, site.domains) : null;
    const name = pick(row, "groupname") ?? parsed?.name ?? host;
    if (!name) continue;
    const visitors = num(pick(row, "visitors"));
    addDim(slot.rollup, "referrer", name, {
      pv: num(pick(row, "pageviews")),
      v: visitors,
      vi: visitors,
      b: Math.round(rate(pick(row, "bounce_rate")) * visitors),
      d: Math.round(num(pick(row, "avg_duration")) * visitors),
    });
    if (parsed) addDim(slot.rollup, "referrer_domain", parsed.domain, { pv: num(pick(row, "pageviews")), v: visitors, vi: visitors });
  }
  return days;
};

/** Writes Fathom rollups as `imp:` docs (re-importing a day replaces it). */
export const importFathom = async (
  config: EngineConfig,
  site: SiteDoc,
  csv: { siteStats?: string; pageStats?: string; referrerStats?: string },
) => {
  const rollups = fathomRowsToRollups(site, {
    siteStats: csv.siteStats ? csvObjects(csv.siteStats) : [],
    pageStats: csv.pageStats ? csvObjects(csv.pageStats) : [],
    referrerStats: csv.referrerStats ? csvObjects(csv.referrerStats) : [],
  });
  for (const [day, rollup] of rollups) {
    const id = importId(site.id, day);
    await upsertDoc(mainDb(config), id, () => ({ ...rollup, _id: id, type: "agg", site: site.id, source: "fathom", importedAt: new Date().toISOString() }));
  }
  return { days: rollups.size };
};
