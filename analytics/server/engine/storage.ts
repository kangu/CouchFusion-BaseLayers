/**
 * Database naming and raw-event access.
 */
import type { EngineConfig } from "./config";
import { collectRange, ensureDatabase, listDatabases } from "./couch";
import { utcMonthKey, utcMonthsInRange } from "./time";
import type { RawEvent } from "./types";

export const mainDb = (config: Pick<EngineConfig, "dbPrefix">): string => config.dbPrefix;

export const rawDbForMonth = (config: Pick<EngineConfig, "dbPrefix">, month: string): string =>
  `${config.dbPrefix}_raw_${month}`;

export const rawDbForTs = (config: Pick<EngineConfig, "dbPrefix">, ts: number): string =>
  rawDbForMonth(config, utcMonthKey(ts));

/** Sortable, fixed-width timestamp for raw-event ids. */
export const tsKey = (ts: number): string => String(Math.max(0, Math.floor(ts))).padStart(13, "0");

/** `<site>:<ts13>:<random>` -- lexicographic order equals time order per site. */
export const rawEventId = (siteId: string, ts: number, random: string): string =>
  `${siteId}:${tsKey(ts)}:${random}`;

/** Ensures the main analytics database exists. */
export const ensureMainDb = async (config: EngineConfig): Promise<string> => {
  const db = mainDb(config);
  await ensureDatabase(db);
  return db;
};

/** Lists existing raw-event month databases, oldest first. */
export const listRawDbs = async (config: EngineConfig): Promise<string[]> => {
  const prefix = `${config.dbPrefix}_raw_`;
  return (await listDatabases(prefix)).filter((name) => /_raw_\d{4}_\d{2}$/.test(name)).sort();
};

/**
 * Reads a site's raw events in `[fromTs, toTs)` across month shards.
 * Missing shards are skipped.
 */
export const readRawEvents = async (
  config: EngineConfig,
  siteId: string,
  fromTs: number,
  toTs: number,
): Promise<RawEvent[]> => {
  if (toTs <= fromTs) return [];
  const events: RawEvent[] = [];
  for (const month of utcMonthsInRange(fromTs, toTs - 1)) {
    const db = rawDbForMonth(config, month);
    const docs = await collectRange<RawEvent>(
      db,
      `${siteId}:${tsKey(fromTs)}`,
      `${siteId}:${tsKey(toTs - 1)}:￰`,
    );
    events.push(...docs);
  }
  return events;
};
