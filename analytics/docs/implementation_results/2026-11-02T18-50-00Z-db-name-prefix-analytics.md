# Analytics database name: `<dbLoginPrefix>-analytics`

Date: 2026-11-02

## Change

New installs name the main analytics database `<runtimeConfig.dbLoginPrefix>-analytics` (e.g. `prosti-analytics` for `apps/paleologu-prosti`) instead of `analytics_<slug>` (`analytics_paleologu_prosti`). Raw shards follow it: `prosti-analytics_raw_<yyyy>_<mm>`.

Resolution order (`server/engine/config.ts`, `resolveDbPrefix`):

1. `analytics_db_prefix` in `_config` `cf_env_[slug]` (unchanged key, still wins).
2. Legacy `analytics_<slug>`, when that database already exists. Checked once per process with `GET /<db>` (404 = absent). A failed check is treated like a failed `_config` read (last good config, or `loaded: false`), so the name is never guessed.
3. `<dbLoginPrefix>-analytics`; trailing `-`/`_` on the login prefix are stripped. Without a usable login prefix: `<slug>-analytics`.

`EngineConfig.dbPrefixSource` (`config` | `legacy` | `default`) records which rule applied; the init plugin logs it.

## Files

- `server/engine/config.ts` — `legacyDbPrefix`, new `defaultDbPrefix(slug, loginPrefix)`, `resolveDbPrefix`, legacy lookup in `resolveEngineConfig`; `buildEngineConfig` takes an optional 4th `naming` argument.
- `server/plugins/init.ts` — logs the source of the name.
- Specs: `p0.spec.ts`, `resilience.spec.ts`, `aggregator.spec.ts`.
- Docs: `README.md`, `README.html`, `docs/self-hosted-analytics.md`, `agents.md`.

## Notes

- Existing installs are untouched: no data is moved or renamed.
- The new name starts with `<dbLoginPrefix>-`, so the database layer's datasync (`remote-dbs.post.ts`, `matchesManagedDbName`) now lists the analytics databases with the app's other databases.

## Tests

`cd layers && npx vitest run --config vitest.config.ts analytics` — 11 files passed, 1 skipped (integration).
