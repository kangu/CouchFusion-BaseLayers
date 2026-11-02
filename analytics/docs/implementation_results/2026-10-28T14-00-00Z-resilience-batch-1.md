# Resilience batch 1

First batch from `2026-10-28T13-00-00Z-perf-resilience-audit.md`.

## Changes
- **Large-read crash** (`server/engine/storage.ts`): `events.push(...docs)` threw a RangeError at ~125k events per month shard (filtered 31-day views on ~5k hits/day sites; the aggregator on ~100k hits/day sites). Now pushes in a loop.
- **Strict `_config` reads** (`server/engine/config.ts`): one request for the whole section via `couch()` (`readConfigSection`). A failed read serves the last good config and retries after 5 s. Before any good read the config has `loaded: false`, and:
  - the collector returns the `unavailable` outcome instead of storing;
  - `ensureAppSite` / `ensureMainDb` throw (`assertConfigLoaded`), and the router maps that to 503;
  - the aggregator tick, retention and startup provisioning are skipped;
  - pixel and link hits aren't recorded.
  The shared `#database` reader is unchanged. The Settings GET uses the strict reader and returns 502 instead of blanks.
- **CouchDB timeouts** (`server/engine/couch.ts`): `AbortSignal.timeout` on every request (15 s; 60 s for `_all_docs`, `_bulk_docs`, `_all_dbs`, db create/delete; 5 s for `_config`). Timeouts become `CouchError` 504 and network errors 503. A cut-off success body now throws instead of reading as an empty result. Unread bodies on 404/create are cancelled.
- **Write queue** (`server/engine/queue.ts`):
  - Failed batches go back to the front and retry with backoff (2 s → 30 s). Writes are chunked at 500.
  - Per-doc `conflict` counts as written (ids are fixed). Other per-doc errors and 400s are dropped and counted.
  - On 404 the db is forgotten so it's re-created. Overflow drops the oldest events and counts them.
  - `enqueueRawEvent` returns false when full; the collector records `queue_full`.
  - The shutdown flush makes one 5 s attempt.
  - `queueStats` and `writes.failing` are exposed in admin status and shown in Settings.
- **Aggregator tail** (`server/engine/aggregator.ts`): the next tail scan starts no later than `oldestPendingTs()`, so events written late after retries still land in today's rollup.
- **Body limits** (`server/engine/body.ts`): a streaming reader that stops at the limit with 413.
  - `/api/stats` allows 32 KB. API routes allow 64 KB by default; `site/import` allows 50 MB via `maxBody`.
  - The router now authenticates before reading the body.
  - The redundant `JSON.stringify(body).length` import check is removed.

## Verification
- `server/engine/resilience.spec.ts` (13 new tests): config loaded / missing / failing / last-good / retry, retention guard, 150k-event read, queue retry + conflict + 404 + per-doc rejection, collector `unavailable`, body limits. Whole suite: 43 passed, 2 skipped (CouchDB integration).
- `apps/smart-lead` production build succeeds.
- Not verified: behaviour against a live CouchDB that goes down and comes back (none was running locally).
