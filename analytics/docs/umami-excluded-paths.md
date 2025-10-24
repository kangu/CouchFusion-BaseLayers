# Umami Excluded Paths Support

## Initial Prompt
Proceed to add options for excluded paths from umami, similar to how it's done in the bitvocation-demo.

## Implementation Summary
Manual implementation; no automated generator output was produced.

## Documentation Overview
- Added `excludedPaths` runtime configuration to `layers/analytics/nuxt.config.ts` and surfaced new environment variable guidance in the layer README.
- Enhanced `plugins/umami.client.ts` to disable Umami auto-tracking when exclusions are present, and manually track router navigations while skipping matching patterns.
- Updated typing imports and manual tracking setup to watch script readiness before emitting page views.

## Implementation Examples
- Runtime defaults capturing excluded paths (`layers/analytics/nuxt.config.ts:16`).
- Manual router tracking with wildcard exclusion matcher (`layers/analytics/plugins/umami.client.ts:165`).
- README environment snippet illustrating `NUXT_PUBLIC_UMAMI_EXCLUDED_PATHS` (`layers/analytics/README.md:63`).
