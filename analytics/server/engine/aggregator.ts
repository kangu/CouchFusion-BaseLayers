/**
 * Single-writer aggregator. Every minute the lease holder recomputes today's
 * (and, shortly after midnight, yesterday's) rollups per site, backfills
 * missed days, applies raw-data retention, and purges old salts.
 */
import { randomBytes } from "node:crypto";
import type { EngineConfig } from "./config";
import { bulk, CouchError, dropDatabase, getDoc, putDoc, scanIds, upsertDoc } from "./couch";
import { purgeOldSalts } from "./identity";
import { computeRollups } from "./rollup";
import { listSites } from "./sites";
import { oldestPendingTs } from "./queue";
import { listRawDbs, mainDb, readRawEvents } from "./storage";
import { addDays, dayEnd, dayStart, daysInRange, localDay } from "./time";
import type { DayRollup, RawEvent, SiteDoc } from "./types";

/** Visits may straddle day boundaries; scan this much on each side. */
export const SCAN_MARGIN_MS = 3 * 3600_000;
const LEASE_TTL_MS = 3 * 60_000;
const TAIL_OVERLAP_MS = 2 * 60_000;
/** While yesterday is still open after midnight, recompute it at most this often. */
const YESTERDAY_RECOMPUTE_MS = 15 * 60_000;
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
  try {
    // Write with the rev just read; only re-read on a conflict.
    await putDoc(db, { ...next, ...(existing?._rev ? { _rev: existing._rev } : {}), computedAt: Date.now() });
  } catch (error) {
    if (!(error instanceof CouchError && error.status === 409)) throw error;
    await upsertDoc(db, id, () => ({ ...next, computedAt: Date.now() }));
  }
  return true;
};

/** Recomputes one day from raw events (authoritative). */
export const computeDayFromRaw = async (config: EngineConfig, site: SiteDoc, day: string) => {
  const start = dayStart(day, site.timezone);
  const end = dayEnd(day, site.timezone);
  const events = await readRawEvents(config, site.id, start - SCAN_MARGIN_MS, end + SCAN_MARGIN_MS);
  return computeRollups(events, { timeZone: site.timezone, days: new Set([day]) }).get(day);
};

/** UTC month index (year * 12 + month) of a timestamp, matching raw shard names. */
const monthIndex = (ts: number): number => {
  const date = new Date(ts);
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
};

const RETENTION_DOC = "meta:retention";

/**
 * First UTC month whose raw events are still complete: nothing older than
 * the retention cutoff, nor any month retention has already dropped (also
 * when retention was raised afterwards).
 */
export const firstCompleteRawMonth = async (config: EngineConfig, now = Date.now()): Promise<number> => {
  const record = await getDoc<{ droppedThrough?: number }>(mainDb(config), RETENTION_DOC);
  const cutoff = monthIndex(now) - config.rawRetentionMonths;
  return Math.max(cutoff, (record?.droppedThrough ?? -Infinity) + 1);
};

/**
 * True when every raw shard a day's scan window touches is still complete.
 * Recomputing a day without its raw events would overwrite a good rollup with
 * zeros (or an undercount at a month boundary).
 */
const rawCoversDay = (site: SiteDoc, day: string, firstMonth: number): boolean =>
  monthIndex(dayStart(day, site.timezone) - SCAN_MARGIN_MS) >= firstMonth;

interface TailCache {
  day: string;
  events: Map<string, RawEvent>;
  lastTs: number;
  /** When the tail was seeded; a newer reset marker discards it. */
  builtAt: number;
  /** New events since the last successful store. */
  dirty: boolean;
}

const tails = new Map<string, TailCache>();
/** Last time yesterday was recomputed while still open, per site. */
const yesterdayComputedAt = new Map<string, { day: string; at: number }>();

const resetMarkerId = (siteId: string) => `reset:${siteId}`;

/**
 * Today's events are cached in memory and extended by tail scans (with an
 * overlap window to catch late batches), so each tick reads only new events.
 * The next scan never starts after the oldest event still waiting in the
 * write queue, so events written late (after a retry) are picked up too.
 */
const loadToday = async (config: EngineConfig, site: SiteDoc, day: string, now: number): Promise<TailCache> => {
  const key = `${config.dbPrefix}:${site.id}`;
  const pending = oldestPendingTs();
  const scannedUpTo = pending === null ? now : Math.min(now, pending);
  let tail = tails.get(key);
  if (tail) {
    // A reset on any instance invalidates this instance's in-memory events.
    const marker = await getDoc<{ at: number }>(mainDb(config), resetMarkerId(site.id));
    if (marker && marker.at >= tail.builtAt) tail = undefined;
  }
  if (!tail || tail.day !== day) {
    const events = await readRawEvents(config, site.id, dayStart(day, site.timezone) - SCAN_MARGIN_MS, now + 1);
    for (const event of events) delete (event as any)._rev;
    // Always store once per new tail: the stored doc may be stale or missing.
    tail = { day, events: new Map(events.map((e) => [e._id, e])), lastTs: scannedUpTo, builtAt: now, dirty: true };
    tails.set(key, tail);
  } else {
    const fresh = await readRawEvents(config, site.id, tail.lastTs - TAIL_OVERLAP_MS, now + 1);
    for (const event of fresh) {
      if (tail.events.has(event._id)) continue;
      delete (event as any)._rev;
      tail.events.set(event._id, event);
      tail.dirty = true;
    }
    tail.lastTs = scannedUpTo;
  }
  return tail;
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

  // Today and the backfill fail independently, so a broken today step can't
  // stop yesterday from being finalized.
  try {
    const tail = await loadToday(config, site, today, now);
    if (tail.dirty) {
      const todayRollup = computeRollups([...tail.events.values()], { timeZone: site.timezone, days: new Set([today]) }).get(today);
      if (await storeRollup(config, site, today, todayRollup)) written.push(today);
      tail.dirty = false;
    }
  } catch (error) {
    console.error(`[analytics] today's rollup failed for site ${site.id}:`, error);
  }

  // Finalize yesterday and backfill gaps (e.g. after downtime).
  const stateId = `state:${site.id}`;
  const state = (await getDoc<SiteState>(db, stateId)) ?? { _id: stateId, finalizedThrough: null };
  const pending: string[] = [];
  const firstPending = state.finalizedThrough ? addDays(state.finalizedThrough, 1) : addDays(today, -7);
  for (const day of daysInRange(firstPending, yesterday)) pending.push(day);
  const withinMargin = now - dayStart(today, site.timezone) < SCAN_MARGIN_MS + 120_000;
  if (withinMargin && !pending.includes(yesterday)) pending.push(yesterday);

  const siteKey = `${config.dbPrefix}:${site.id}`;
  const firstMonth = pending.length ? await firstCompleteRawMonth(config, now) : 0;
  let finalizedThrough = state.finalizedThrough;
  for (const day of pending.slice(0, BACKFILL_DAYS_PER_TICK)) {
    const open = day === yesterday && withinMargin;
    const last = yesterdayComputedAt.get(siteKey);
    // While yesterday is open, recompute it on the first tick after midnight
    // and then every YESTERDAY_RECOMPUTE_MS, not on every tick.
    if (open && last?.day === day && now - last.at < YESTERDAY_RECOMPUTE_MS) continue;
    // Days whose raw shards were dropped keep their stored rollup.
    if (rawCoversDay(site, day, firstMonth)) {
      const rollup = await computeDayFromRaw(config, site, day);
      if (await storeRollup(config, site, day, rollup)) written.push(day);
    }
    if (open) yesterdayComputedAt.set(siteKey, { day, at: now });
    // Yesterday stays "open" until the scan margin has passed.
    if (!open && (!finalizedThrough || day > finalizedThrough)) finalizedThrough = day;
  }
  if (finalizedThrough !== state.finalizedThrough) {
    await upsertDoc<SiteState>(db, stateId, (current) => ({ ...(current ?? { _id: stateId }), finalizedThrough }));
  }
  return written;
};

/** Drops raw-event month databases older than the retention window. */
export const applyRetention = async (config: EngineConfig, now = Date.now()) => {
  // Retention deletes whole databases: only act on settings that really loaded.
  if (!config.loaded) return [];
  const date = new Date(now);
  const cutoffIndex = date.getUTCFullYear() * 12 + date.getUTCMonth() - config.rawRetentionMonths;
  const dropped: string[] = [];
  for (const name of await listRawDbs(config)) {
    const match = name.match(/_raw_(\d{4})_(\d{2})$/);
    if (!match) continue;
    const index = Number(match[1]) * 12 + Number(match[2]) - 1;
    if (index < cutoffIndex) {
      // Record first, so a rebuild never trusts a month that may be gone.
      await upsertDoc<{ _id: string; droppedThrough?: number }>(mainDb(config), RETENTION_DOC, (current) =>
        (current?.droppedThrough ?? -Infinity) >= index ? null : { ...(current ?? { _id: RETENTION_DOC }), droppedThrough: index },
      );
      await dropDatabase(name);
      dropped.push(name);
    }
  }
  return dropped;
};

let lastHousekeeping = 0;

/** Full aggregator tick (lease-guarded). */
export const runAggregatorTick = async (config: EngineConfig, now = Date.now()) => {
  if (!config.loaded) return { leader: false, written: {} };
  if (!(await acquireLease(config, now))) {
    // Another instance aggregates: free the memory and start fresh if we lead again.
    tails.clear();
    yesterdayComputedAt.clear();
    return { leader: false, written: {} };
  }
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

/**
 * Recomputes rollups for a day range from raw events. Days whose raw events
 * were dropped by retention are skipped (their rollups are kept) and reported.
 */
export const rebuildRange = async (config: EngineConfig, site: SiteDoc, from: string, to: string, now = Date.now()) => {
  const days = daysInRange(from, to, 400);
  const firstMonth = await firstCompleteRawMonth(config, now);
  let written = 0;
  const skipped: string[] = [];
  for (const day of days) {
    if (!rawCoversDay(site, day, firstMonth)) {
      skipped.push(day);
      continue;
    }
    if (await storeRollup(config, site, day, await computeDayFromRaw(config, site, day))) written += 1;
  }
  tails.delete(`${config.dbPrefix}:${site.id}`);
  return { days: days.length, written, skipped: skipped.length, skippedThrough: skipped.length ? skipped[skipped.length - 1] : null };
};

/** Deletes every doc in an id range, page by page, without holding them in memory. */
const purgeRange = async (database: string, start: string, end: string): Promise<number> => {
  let deleted = 0;
  for (;;) {
    const page = await scanIds(database, start, end, 1000);
    if (!page.length) return deleted;
    const results = (await bulk(database, page.map((row) => ({ _id: row.id, _rev: row.rev, _deleted: true })))) ?? [];
    const ok = results.filter((r) => !r.error).length;
    // Conflicts mean someone else changed the doc; the next page re-reads it.
    if (!ok) throw new Error(`Could not delete documents in ${database} (${results[0]?.error ?? "no result"})`);
    deleted += ok;
  }
};

/**
 * Deletes all raw events, rollups, imports and state for a site, then writes
 * a reset marker so every instance drops its in-memory copy of today.
 * Errors propagate: a partial reset is reported, and rerunning it is safe.
 */
export const resetSiteData = async (config: EngineConfig, site: SiteDoc) => {
  const db = mainDb(config);
  let deleted = 0;
  for (const raw of await listRawDbs(config)) deleted += await purgeRange(raw, `${site.id}:`, `${site.id}:\ufff0`);
  deleted += await purgeRange(db, `agg:${site.id}:`, `agg:${site.id}:\ufff0`);
  deleted += await purgeRange(db, `imp:${site.id}:`, `imp:${site.id}:\ufff0`);
  deleted += await purgeRange(db, `state:${site.id}`, `state:${site.id}`);
  await upsertDoc(db, resetMarkerId(site.id), (current) => ({ ...(current ?? { _id: resetMarkerId(site.id) }), at: Date.now() }));
  tails.delete(`${config.dbPrefix}:${site.id}`);
  yesterdayComputedAt.delete(`${config.dbPrefix}:${site.id}`);
  return { deleted };
};

/** Test seam. */
export const resetAggregatorCaches = () => {
  tails.clear();
  yesterdayComputedAt.clear();
  lastHousekeeping = 0;
};
