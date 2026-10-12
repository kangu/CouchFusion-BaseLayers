/**
 * Single-writer aggregator. Every minute the lease holder recomputes today's
 * (and, shortly after midnight, yesterday's) rollups per site, backfills
 * missed days, applies raw-data retention, and purges old salts.
 */
import { randomBytes } from "node:crypto";
import type { EngineConfig } from "./config";
import { bulk, collectRange, CouchError, dropDatabase, getDoc, putDoc, upsertDoc } from "./couch";
import { purgeOldSalts } from "./identity";
import { computeRollups } from "./rollup";
import { listSites } from "./sites";
import { listRawDbs, mainDb, readRawEvents } from "./storage";
import { addDays, dayEnd, dayStart, daysInRange, localDay } from "./time";
import type { DayRollup, RawEvent, SiteDoc } from "./types";

/** Visits may straddle day boundaries; scan this much on each side. */
export const SCAN_MARGIN_MS = 3 * 3600_000;
const LEASE_TTL_MS = 3 * 60_000;
const TAIL_OVERLAP_MS = 2 * 60_000;
const BACKFILL_DAYS_PER_TICK = 3;

export const instanceId = randomBytes(6).toString("hex");

export const rollupId = (siteId: string, day: string) => `agg:${siteId}:${day}`;
export const importId = (siteId: string, day: string) => `imp:${siteId}:${day}`;

/** Tries to take or renew the aggregator lease. */
export const acquireLease = async (config: EngineConfig, now = Date.now()): Promise<boolean> => {
  const db = mainDb(config);
  const id = "lock:aggregator";
  const current = await getDoc<{ _rev: string; owner: string; expiresAt: number }>(db, id);
  if (current && current.owner !== instanceId && current.expiresAt > now) return false;
  try {
    await putDoc(db, {
      _id: id,
      ...(current?._rev ? { _rev: current._rev } : {}),
      type: "lock",
      owner: instanceId,
      expiresAt: now + LEASE_TTL_MS,
    });
    return true;
  } catch (error) {
    if (error instanceof CouchError && error.status === 409) return false;
    throw error;
  }
};

/** Releases the lease on shutdown so a replacement instance can take over at once. */
export const releaseLease = async (config: EngineConfig): Promise<void> => {
  const db = mainDb(config);
  const current = await getDoc<{ _rev: string; owner: string }>(db, "lock:aggregator");
  if (current?.owner !== instanceId) return;
  await putDoc(db, { ...current, _id: "lock:aggregator", expiresAt: 0 }).catch(() => undefined);
};

const stable = (rollup: DayRollup | null) => {
  if (!rollup) return "";
  const { _id, _rev, computedAt, ...rest } = rollup as any;
  return JSON.stringify(rest);
};

/** Writes a rollup only when its content changed. Empty days are not created. */
export const storeRollup = async (
  config: EngineConfig,
  site: SiteDoc,
  day: string,
  rollup: DayRollup | undefined,
): Promise<boolean> => {
  const db = mainDb(config);
  const id = rollupId(site.id, day);
  const existing = await getDoc<DayRollup>(db, id);
  if (!rollup && !existing) return false;
  const next: DayRollup = {
    ...(rollup ?? { day, totals: { visitors: 0, visits: 0, pageviews: 0, bounces: 0, duration: 0, events: 0 }, hours: [], dims: {}, revenue: {} }),
    _id: id,
    type: "agg",
    site: site.id,
    day,
  };
  if (existing && stable({ ...existing, type: "agg", site: site.id }) === stable(next)) return false;
  await upsertDoc(db, id, () => ({ ...next, computedAt: Date.now() }));
  return true;
};

/** Recomputes one day from raw events (authoritative). */
export const computeDayFromRaw = async (config: EngineConfig, site: SiteDoc, day: string) => {
  const start = dayStart(day, site.timezone);
  const end = dayEnd(day, site.timezone);
  const events = await readRawEvents(config, site.id, start - SCAN_MARGIN_MS, end + SCAN_MARGIN_MS);
  return computeRollups(events, { timeZone: site.timezone, days: new Set([day]) }).get(day);
};

interface TailCache {
  day: string;
  events: Map<string, RawEvent>;
  lastTs: number;
}

const tails = new Map<string, TailCache>();

/**
 * Today's events are cached in memory and extended by tail scans (with an
 * overlap window to catch late batches), so each tick reads only new events.
 */
const loadToday = async (config: EngineConfig, site: SiteDoc, day: string, now: number) => {
  const key = `${config.dbPrefix}:${site.id}`;
  let tail = tails.get(key);
  if (!tail || tail.day !== day) {
    const events = await readRawEvents(config, site.id, dayStart(day, site.timezone) - SCAN_MARGIN_MS, now + 1);
    tail = { day, events: new Map(events.map((e) => [e._id, e])), lastTs: now };
    tails.set(key, tail);
  } else {
    const fresh = await readRawEvents(config, site.id, tail.lastTs - TAIL_OVERLAP_MS, now + 1);
    for (const event of fresh) tail.events.set(event._id, event);
    tail.lastTs = now;
  }
  return [...tail.events.values()];
};

interface SiteState {
  _id: string;
  _rev?: string;
  finalizedThrough: string | null;
}

/** One aggregation pass for a site. */
export const aggregateSite = async (config: EngineConfig, site: SiteDoc, now = Date.now()) => {
  const db = mainDb(config);
  const today = localDay(now, site.timezone);
  const yesterday = addDays(today, -1);
  const written: string[] = [];

  const todayEvents = await loadToday(config, site, today, now);
  const todayRollup = computeRollups(todayEvents, { timeZone: site.timezone, days: new Set([today]) }).get(today);
  if (await storeRollup(config, site, today, todayRollup)) written.push(today);

  // Finalize yesterday and backfill gaps (e.g. after downtime).
  const stateId = `state:${site.id}`;
  const state = (await getDoc<SiteState>(db, stateId)) ?? { _id: stateId, finalizedThrough: null };
  const pending: string[] = [];
  const firstPending = state.finalizedThrough ? addDays(state.finalizedThrough, 1) : addDays(today, -7);
  for (const day of daysInRange(firstPending, yesterday)) pending.push(day);
  const withinMargin = now - dayStart(today, site.timezone) < SCAN_MARGIN_MS + 120_000;
  if (withinMargin && !pending.includes(yesterday)) pending.push(yesterday);

  let finalizedThrough = state.finalizedThrough;
  for (const day of pending.slice(0, BACKFILL_DAYS_PER_TICK)) {
    const rollup = await computeDayFromRaw(config, site, day);
    if (await storeRollup(config, site, day, rollup)) written.push(day);
    // Yesterday stays "open" until the scan margin has passed.
    if (day < yesterday || !withinMargin) {
      if (!finalizedThrough || day > finalizedThrough) finalizedThrough = day;
    }
  }
  if (finalizedThrough !== state.finalizedThrough) {
    await upsertDoc<SiteState>(db, stateId, (current) => ({ ...(current ?? { _id: stateId }), finalizedThrough }));
  }
  return written;
};

/** Drops raw-event month databases older than the retention window. */
export const applyRetention = async (config: EngineConfig, now = Date.now()) => {
  const date = new Date(now);
  const cutoffIndex = date.getUTCFullYear() * 12 + date.getUTCMonth() - config.rawRetentionMonths;
  const dropped: string[] = [];
  for (const name of await listRawDbs(config)) {
    const match = name.match(/_raw_(\d{4})_(\d{2})$/);
    if (!match) continue;
    const index = Number(match[1]) * 12 + Number(match[2]) - 1;
    if (index < cutoffIndex) {
      await dropDatabase(name);
      dropped.push(name);
    }
  }
  return dropped;
};

let lastHousekeeping = 0;

/** Full aggregator tick (lease-guarded). */
export const runAggregatorTick = async (config: EngineConfig, now = Date.now()) => {
  if (!(await acquireLease(config, now))) return { leader: false, written: {} };
  const written: Record<string, string[]> = {};
  for (const site of await listSites(config, { fresh: true })) {
    try {
      written[site.id] = await aggregateSite(config, site, now);
    } catch (error) {
      console.error(`[analytics] aggregation failed for site ${site.id}:`, error);
    }
  }
  if (now - lastHousekeeping > 3600_000) {
    lastHousekeeping = now;
    await applyRetention(config, now).catch((error) => console.error("[analytics] retention failed:", error));
    await purgeOldSalts(config, localDay(now, "UTC")).catch(() => undefined);
  }
  return { leader: true, written };
};

/** Recomputes rollups for a day range from raw events. */
export const rebuildRange = async (config: EngineConfig, site: SiteDoc, from: string, to: string) => {
  const days = daysInRange(from, to, 400);
  let written = 0;
  for (const day of days) {
    if (await storeRollup(config, site, day, await computeDayFromRaw(config, site, day))) written += 1;
  }
  tails.delete(`${config.dbPrefix}:${site.id}`);
  return { days: days.length, written };
};

/** Deletes all raw events, rollups, imports and state for a site. */
export const resetSiteData = async (config: EngineConfig, site: SiteDoc) => {
  const db = mainDb(config);
  let deleted = 0;
  const purge = async (database: string, start: string, end: string) => {
    for (;;) {
      const docs = await collectRange<{ _id: string; _rev: string }>(database, start, end).catch(() => []);
      if (!docs.length) return;
      for (let i = 0; i < docs.length; i += 1000) {
        await bulk(database, docs.slice(i, i + 1000).map((d) => ({ _id: d._id, _rev: d._rev, _deleted: true })));
      }
      deleted += docs.length;
      if (docs.length < 1000) return;
    }
  };
  for (const raw of await listRawDbs(config)) await purge(raw, `${site.id}:`, `${site.id}:￰`);
  await purge(db, `agg:${site.id}:`, `agg:${site.id}:￰`);
  await purge(db, `imp:${site.id}:`, `imp:${site.id}:￰`);
  await purge(db, `state:${site.id}`, `state:${site.id}`);
  tails.delete(`${config.dbPrefix}:${site.id}`);
  return { deleted };
};

/** Test seam. */
export const resetAggregatorCaches = () => {
  tails.clear();
  lastHousekeeping = 0;
};
