/**
 * Batches raw events and writes them with `_bulk_docs`, grouped by month
 * shard. Flushes every second or every 200 events.
 *
 * When CouchDB can't take a batch, the batch goes back to the front of the
 * buffer and is retried with exponential backoff (2 s … 30 s). Re-sending is
 * safe: every raw event has a fixed `_id`, so docs that did get written come
 * back as per-doc conflicts and are not duplicated. The buffer is capped at
 * MAX_BUFFER; past that the oldest events are dropped and counted. A crash
 * loses whatever is still buffered.
 */
import type { EngineConfig } from "./config";
import { bulk, CouchError, ensureDatabase, forgetDatabase } from "./couch";
import { rawDbForTs } from "./storage";
import type { RawEvent } from "./types";

const FLUSH_INTERVAL_MS = 1000;
const FLUSH_SIZE = 200;
const WRITE_CHUNK = 500;
const MAX_BUFFER = 20_000;
const MAX_BACKOFF_MS = 30_000;

type Item = { config: EngineConfig; doc: RawEvent };

let buffer: Item[] = [];
let inFlight: Item[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing: Promise<void> | null = null;
/** Consecutive failed flushes; drives the backoff. */
let failures = 0;

/** Counters since process start, shown in the admin status. */
export const queueStats = { written: 0, dropped: 0, retried: 0 };

const schedule = (delayMs: number) => {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void flushRawEvents();
  }, delayMs);
  timer.unref?.();
};

const backoffMs = () => Math.min(MAX_BACKOFF_MS, 1000 * 2 ** failures);

/** Adds a raw event to the write buffer. Returns false when the buffer is full. */
export const enqueueRawEvent = (config: EngineConfig, doc: RawEvent): boolean => {
  if (buffer.length >= MAX_BUFFER) {
    // Back-pressure: drop rather than exhaust memory while CouchDB is down.
    queueStats.dropped += 1;
    return false;
  }
  buffer.push({ config, doc });
  // While failing, wait for the backoff timer instead of hammering CouchDB.
  if (buffer.length >= FLUSH_SIZE && failures === 0) void flushRawEvents();
  else schedule(failures ? backoffMs() : FLUSH_INTERVAL_MS);
  return true;
};

/** Writes a batch; returns the items that should be retried. */
const writeBatch = async (batch: Item[], timeoutMs?: number): Promise<Item[]> => {
  const groups = new Map<string, Item[]>();
  for (const item of batch) {
    const db = rawDbForTs(item.config, item.doc.ts);
    const list = groups.get(db) ?? [];
    list.push(item);
    groups.set(db, list);
  }
  const retry: Item[] = [];
  for (const [db, items] of groups) {
    for (let i = 0; i < items.length; i += WRITE_CHUNK) {
      const chunk = items.slice(i, i + WRITE_CHUNK);
      try {
        await ensureDatabase(db);
        const results = (await bulk(db, chunk.map((item) => item.doc), timeoutMs)) ?? [];
        // "conflict" means the doc was already written by an earlier attempt.
        const rejected = results.filter((r) => r.error && r.error !== "conflict");
        queueStats.written += chunk.length - rejected.length;
        if (rejected.length) {
          // Per-doc rejections (invalid doc, too large) won't succeed on retry.
          queueStats.dropped += rejected.length;
          console.error(`[analytics] ${db} rejected ${rejected.length} events: ${rejected[0].error} ${rejected[0].reason ?? ""}`);
        }
      } catch (error) {
        if (error instanceof CouchError && error.status === 404) forgetDatabase(db);
        if (error instanceof CouchError && error.status === 400) {
          queueStats.dropped += chunk.length;
          console.error(`[analytics] ${db} refused ${chunk.length} events:`, error.message);
          continue;
        }
        retry.push(...chunk);
        if (failures === 0) console.warn(`[analytics] could not write ${chunk.length} events to ${db}; retrying:`, (error as Error)?.message ?? error);
      }
    }
  }
  return retry;
};

/**
 * Writes everything currently buffered. Failed items are put back (oldest
 * first) and retried later. `timeoutMs` bounds each bulk request, for the
 * shutdown flush.
 */
export const flushRawEvents = async ({ timeoutMs }: { timeoutMs?: number } = {}): Promise<void> => {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (flushing) await flushing;
  if (buffer.length === 0) return;
  const batch = buffer;
  buffer = [];
  inFlight = batch;
  flushing = (async () => {
    const retry = await writeBatch(batch, timeoutMs);
    inFlight = [];
    if (retry.length) {
      failures += 1;
      queueStats.retried += retry.length;
      buffer = retry.concat(buffer);
      const overflow = buffer.length - MAX_BUFFER;
      if (overflow > 0) {
        buffer.splice(0, overflow);
        queueStats.dropped += overflow;
        console.error(`[analytics] write buffer full; dropped the ${overflow} oldest events`);
      }
    } else if (failures) {
      console.info("[analytics] event writes recovered");
      failures = 0;
    }
  })().finally(() => {
    flushing = null;
  });
  await flushing;
  if (buffer.length) schedule(failures ? backoffMs() : FLUSH_INTERVAL_MS);
};

/** Number of buffered, unwritten events (including a batch being written). */
export const pendingRawEvents = (): number => buffer.length + inFlight.length;

/** True while writes are failing and being retried. */
export const rawWritesFailing = (): boolean => failures > 0;

/**
 * Timestamp of the oldest event not yet written, or null. The aggregator
 * rescans from here so events written late (after a retry) still count.
 */
export const oldestPendingTs = (): number | null => {
  let oldest: number | null = null;
  for (const list of [inFlight, buffer]) {
    for (const { doc } of list) if (oldest === null || doc.ts < oldest) oldest = doc.ts;
  }
  return oldest;
};
