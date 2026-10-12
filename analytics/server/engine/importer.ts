/**
 * Data import:
 *  - Umami `website_event` CSV export (+ optional `session` CSV joined on
 *    session_id) -> raw events (src: "umami"), then affected days rebuilt.
 *  - Fathom Lite aggregate CSVs (site_stats / page_stats / referrer_stats,
 *    hourly rows with hostname/pathname resolved) -> `imp:<site>:<day>`
 *    rollups that are merged into dashboards (raw-only features such as
 *    filters and reports do not include them).
 */
import { createHash } from "node:crypto";
import type { EngineConfig } from "./config";
import { bulk, ensureDatabase, upsertDoc } from "./couch";
import { importId, rebuildRange } from "./aggregator";
import { parseCsv } from "./csv";
import { normalizePath } from "./hit";
import { classifyChannel, hasClickId, parseReferrer, parseUtm } from "./referrer";
import { mainDb, rawDbForTs, rawEventId } from "./storage";
import { localDay, localHour } from "./time";
import type { DayRollup, RawEvent, SiteDoc } from "./types";

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

const DEVICE: Record<string, string> = { mobile: "mobile", tablet: "tablet", desktop: "desktop", laptop: "desktop" };

/** Maps Umami export rows to raw events. Pure. */
export const umamiRowsToEvents = (
  site: SiteDoc,
  eventRows: Record<string, string>[],
  sessionRows: Record<string, string>[] = [],
): RawEvent[] => {
  const sessions = new Map(sessionRows.map((row) => [pick(row, "session_id", "id") ?? "", row]));
  const events: RawEvent[] = [];
  let seq = 0;
  for (const row of eventRows) {
    const ts = parseTs(pick(row, "created_at", "timestamp", "date"));
    const sessionId = pick(row, "session_id") ?? pick(row, "visit_id");
    if (ts === null || !sessionId) continue;
    const session = { ...(sessions.get(sessionId) ?? {}), ...row };
    const day = localDay(ts, site.timezone);
    const visitor = createHash("sha256").update(`umami|${site.id}|${sessionId}|${day}`).digest("hex").slice(0, 16);
    const query = new URLSearchParams(pick(row, "url_query") ?? "");
    const referrerDomain = pick(row, "referrer_domain");
    const hostname = pick(session, "hostname") ?? site.domains[0] ?? "imported";
    const referrer = referrerDomain ? parseReferrer(`https://${referrerDomain}${pick(row, "referrer_path") ?? "/"}`, [hostname, ...site.domains]) : null;
    const utm = parseUtm(query);
    const eventType = pick(row, "event_type");
    const name = pick(row, "event_name");
    const isEvent = eventType === "2" || (eventType !== "1" && Boolean(name));
    const country = pick(session, "country");
    const region = pick(session, "subdivision1", "region");
    const doc: RawEvent = {
      _id: rawEventId(site.id, ts, `u${(seq++).toString(36)}`),
      t: isEvent ? "ev" : "pv",
      ts,
      v: visitor,
      p: normalizePath(pick(row, "url_path") ?? "/"),
      h: hostname.replace(/^www\./, ""),
      ch: classifyChannel(referrer, utm, hasClickId(query)),
      br: pick(session, "browser") ?? "Other",
      os: pick(session, "os") ?? "Other",
      dv: DEVICE[(pick(session, "device") ?? "").toLowerCase()] ?? "desktop",
      src: "umami",
    };
    const title = pick(row, "page_title");
    if (title) doc.ti = title.slice(0, 200);
    if (referrer) Object.assign(doc, { r: referrer.name, rd: referrer.domain, rp: referrer.path });
    if (Object.values(utm).some(Boolean)) doc.utm = utm;
    const screen = pick(session, "screen");
    if (screen) doc.sc = screen;
    const language = pick(session, "language");
    if (language) doc.lg = language.toLowerCase();
    if (country && /^[A-Za-z]{2}$/.test(country)) doc.cc = country.toUpperCase();
    if (doc.cc && region) doc.rg = region.replace(new RegExp(`^${doc.cc}-`, "i"), "").slice(0, 20);
    const city = pick(session, "city");
    if (doc.cc && city) doc.ci = city.slice(0, 80);
    if (isEvent) doc.n = (name ?? "event").slice(0, 100);
    const tag = pick(row, "tag");
    if (tag) doc.tg = tag.slice(0, 50);
    const distinct = pick(session, "distinct_id");
    if (distinct) doc.uid = distinct.slice(0, 100);
    events.push(doc);
  }
  return events;
};

/** Imports Umami rows into raw shards and rebuilds the affected days. */
export const importUmami = async (config: EngineConfig, site: SiteDoc, eventsCsv: string, sessionsCsv?: string) => {
  const events = umamiRowsToEvents(site, csvObjects(eventsCsv), sessionsCsv ? csvObjects(sessionsCsv) : []);
  const byDb = new Map<string, RawEvent[]>();
  for (const event of events) {
    const db = rawDbForTs(config, event.ts);
    const list = byDb.get(db) ?? [];
    list.push(event);
    byDb.set(db, list);
  }
  let written = 0;
  for (const [db, docs] of byDb) {
    await ensureDatabase(db);
    for (let i = 0; i < docs.length; i += 1000) {
      const result = await bulk(db, docs.slice(i, i + 1000));
      written += (result ?? []).filter((r) => !r.error).length;
    }
  }
  const days = [...new Set(events.map((e) => localDay(e.ts, site.timezone)))].sort();
  const rebuilt = days.length ? await rebuildRange(config, site, days[0], days[days.length - 1]) : { days: 0, written: 0 };
  return { rows: events.length, written, skippedDuplicates: events.length - written, days: rebuilt.days };
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
