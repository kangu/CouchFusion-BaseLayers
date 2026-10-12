/**
 * Batches raw events and writes them with `_bulk_docs`, grouped by month
 * shard. Flushes every second or every 200 events; a crash loses at most the
 * current batch.
 */
import type { EngineConfig } from "./config";
import { bulk, ensureDatabase } from "./couch";
import { rawDbForTs } from "./storage";
import type { RawEvent } from "./types";

const FLUSH_INTERVAL_MS = 1000;
const FLUSH_SIZE = 200;
const MAX_BUFFER = 20_000;

let buffer: Array<{ config: EngineConfig; doc: RawEvent }> = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing: Promise<void> | null = null;

/** Adds a raw event to the write buffer. */
export const enqueueRawEvent = (config: EngineConfig, doc: RawEvent): void => {
  if (buffer.length >= MAX_BUFFER) {
    // Back-pressure: drop rather than exhaust memory when CouchDB is down.
    return;
  }
  buffer.push({ config, doc });
  if (buffer.length >= FLUSH_SIZE) {
    void flushRawEvents();
  } else if (!timer) {
    timer = setTimeout(() => void flushRawEvents(), FLUSH_INTERVAL_MS);
  }
};

const writeBatch = async (batch: Array<{ config: EngineConfig; doc: RawEvent }>) => {
  const groups = new Map<string, RawEvent[]>();
  for (const { config, doc } of batch) {
    const db = rawDbForTs(config, doc.ts);
    const list = groups.get(db) ?? [];
    list.push(doc);
    groups.set(db, list);
  }
  for (const [db, docs] of groups) {
    try {
      await ensureDatabase(db);
      await bulk(db, docs);
    } catch (error) {
      try {
        await bulk(db, docs);
      } catch {
        console.error(`[analytics] dropped ${docs.length} events for ${db}:`, error);
      }
    }
  }
};

/** Writes everything currently buffered. */
export const flushRawEvents = async (): Promise<void> => {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (flushing) {
    await flushing;
  }
  if (buffer.length === 0) return;
  const batch = buffer;
  buffer = [];
  flushing = writeBatch(batch).finally(() => {
    flushing = null;
  });
  await flushing;
  if (buffer.length && !timer) {
    timer = setTimeout(() => void flushRawEvents(), FLUSH_INTERVAL_MS);
  }
};

/** Number of buffered, unwritten events. */
export const pendingRawEvents = (): number => buffer.length;
