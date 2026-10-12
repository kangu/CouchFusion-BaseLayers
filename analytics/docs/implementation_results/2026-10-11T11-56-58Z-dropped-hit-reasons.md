# Dropped-hit reasons in Settings

## Initial prompt
"I see a request being sent on localhost:2004, but I don't see it reflected in the admin."

## Plan followed
1. Checked CouchDB: the 11:54 hit to `/` was not stored; the server's stored counter was 0 since its last code reload.
2. Sent one test hit with plain headers: stored. So the pipeline works and the browser's hit was dropped by a rule.
3. Most likely rule: `analytics_respect_dnt` (default true) drops hits carrying `DNT: 1` or `Sec-GPC: 1`. Not confirmed, because the browser's request headers weren't visible.
4. Added per-outcome counters (`outcomeStats` in `server/engine/collector.ts`), exposed as `status.outcomes`, shown in Settings → Engine with plain-language reasons.

## Summary
- Verified on the running server: a hit with `Sec-GPC: 1` counted as `dnt`, a hit to `/admin/probe` counted as `excluded`.
- Removed the test hit and rebuilt today's rollup.
- 35 unit tests pass.

## Next steps
- Reload a public page in the affected browser, then read Settings → Engine to see the recorded reason.
