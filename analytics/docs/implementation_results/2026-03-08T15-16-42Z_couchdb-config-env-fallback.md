# Initial Prompt
Proceed with the implementation plan and apply CouchDB `_config` env fallback to analytics using app-folder slug convention.

# Implementation Summary
Implemented analytics server fallback to CouchDB `_config` namespaces (`cf_env_[slug]`, default slug from app folder name) for Umami website id and excluded paths.

# Documentation Overview
- Updated `layers/analytics/server/api/stats.post.ts`:
  - resolves section as `cf_env_[slug]` using `runtimeConfig.analytics.umami.couchEnvSlug` override, otherwise app-folder basename.
  - reads `_config` keys:
    - `UMAMI_WEBSITE_ID`
    - `NUXT_PUBLIC_UMAMI_WEBSITE_ID`
    - `NUXT_PUBLIC_UMAMI_EXCLUDED_PATHS`
  - preserves runtime config precedence and keeps existing upstream proxy behavior.
- Updated `layers/analytics/nuxt.config.ts` defaults with `couchEnvSlug`.
- Updated `layers/analytics/README.md` with CouchDB `_config` fallback notes.

