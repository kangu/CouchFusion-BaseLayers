# Resilience batch 2

Second batch from `2026-10-28T13-00-00Z-perf-resilience-audit.md`.

## Changes
- **Rebuild no longer zeroes pruned days** (`server/engine/aggregator.ts`):
  - `firstCompleteRawMonth` combines the retention cutoff with a new `meta:retention` doc. `applyRetention` writes `droppedThrough` before it drops a shard, so the record stays right even if retention is raised later.
  - A day is recomputed only when its whole ±3 h scan window lies in complete months. Rebuild returns `skipped` and `skippedThrough`, and Settings shows them.
  - Backfill uses the same check.
  - Days whose raw data exists but has no events are still zeroed, which is what a rebuild after an exclusion change needs.
- **Reset**:
  - Pages through ids only (new `scanIds` in `couch.ts`) and deletes page by page. It no longer loads every raw doc into memory.
  - Errors propagate instead of being swallowed. A page where nothing could be deleted throws.
  - Writes `reset:<site>` (`{ at }`). Every aggregator checks it each tick and discards a tail built before it, so a reset on one instance isn't undone by the leader's in-memory events.
- **Aggregator cost**:
  - Today's rollup is recomputed only when the tail gained new events (`dirty`), and always once per new tail. The flag is cleared only after a successful store.
  - Yesterday is recomputed on the first tick after midnight, then at most every 15 min until the 3 h margin passes, then finalized. That replaces about 180 full-day scans per night.
  - `storeRollup` writes with the rev it just read, and re-reads only on 409 (one GET instead of two).
  - Tails are dropped when the lease is lost, and tail docs no longer keep `_rev`.
  - Today's step and the backfill fail independently, so a broken today step no longer blocks finalizing yesterday.
- **Timezone hot path** (`server/engine/time.ts`): `localDay`/`localHour` use a per-zone, 15-minute-bucket offset cache, cleared above 50k entries, instead of `Intl.formatToParts` per call. Checked against Intl on 1.16M timestamps across 8 zones (DST, :30/:45, Chatham, Lord Howe) with 0 mismatches. This speeds up rollups, filtered queries, reports and the importer.
- **Router pageviews** (`plugins/analytics.client.ts`):
  - Skips navigation failures (duplicate/aborted/cancelled) and repeat URLs.
  - Hash-only changes are ignored unless the new `public.analytics.trackHashChanges` is set. Query changes still count.
  - The hit is sent on unhead `dom:rendered`, with a 300 ms fallback, and flushed by the next navigation or `pagehide`. That way it carries the new page's title instead of the previous one.

## Verification
- New `server/engine/aggregator.spec.ts` (9 tests): offset cache vs Intl, rebuild skip and still-zero cases, dirty skip, yesterday throttle and final pass, reset marker, today failure not blocking finalization, paged reset and error reporting.
- Each aggregator fix was mutation-checked: removing the fix makes its test fail.
- Whole suite: 52 passed, 2 skipped (CouchDB integration).
- `apps/smart-lead` production build succeeds, and the tracker hook is in the client bundle.
- Not verified in a browser: the deferred-title pageview and failure skipping (no local CouchDB running for an app to serve pages).
