# App Slug Startup Log

## Initial Prompt

Output somewhere in the console startup logs the value for `appSlug` which is used to retrieve configuration data from the CouchDB `_config`.

## Plan Followed

- Find the shared source of truth for `_config` section resolution.
- Add a shared runtime app-slug resolver in the database layer.
- Log the resolved app slug and resulting `cf_env_[slug]` section once during Nitro startup.
- Ensure Bitvocation exposes `public.appSlug` explicitly so the logged value matches app intent.

## Implementation Summary

- Added `resolveRuntimeAppSlug()` to [layers/database/utils/couch-config.ts](/Users/radu/Projects/nuxt-apps/layers/database/utils/couch-config.ts:1).
- Added a Nitro startup plugin at [layers/database/server/plugins/app-slug-log.ts](/Users/radu/Projects/nuxt-apps/layers/database/server/plugins/app-slug-log.ts:1).
- The startup log now prints:
  - resolved `appSlug`
  - resolved CouchDB `_config` section name
- Current log format:
  - `[database] startup appSlug for CouchDB _config: <slug> (section: cf_env_<slug>)`

## Verification

- `git diff --check -- layers/database/utils/couch-config.ts layers/database/utils/couch-config.spec.ts layers/database/server/plugins/app-slug-log.ts apps/bitvocation/nuxt.config.ts`

## Notes

- A focused unit spec was added at [layers/database/utils/couch-config.spec.ts](/Users/radu/Projects/nuxt-apps/layers/database/utils/couch-config.spec.ts:1), but this environment’s shared `layers/vitest.config.ts` bootstraps the CouchDB harness and fails early because local CouchDB is not reachable (`EPERM` on `127.0.0.1:5984` / `::1:5984`).
