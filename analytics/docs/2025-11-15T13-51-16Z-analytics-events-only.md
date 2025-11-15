# Initial Prompt
Drop the "pageview" reference entirely and only use "event" from now on, as it was before the recent refactor.

# Implementation Summary
Manual implementation; no automated code generator output was produced.

# Documentation Overview
- Removed the post-refactor fallback that labeled unnamed payloads as `pageview`, returning to the previous behavior where every hit is treated as an `event` without implicit renaming.
- Simplified the `/api/stats` proxy so it no longer mutates the payload `name`, ensuring the upstream receives exactly what the client sends while still forcing the request `type` to `event`.
- Trimmed the README to eliminate the mention of automatic `pageview` labeling.

# Implementation Examples
- `layers/analytics/composables/useAnalytics.ts` now calls `sendPayload` with the original payload data and always posts `{ type: 'event' }` to the proxy without injecting a synthetic name.
- `layers/analytics/server/api/stats.post.ts` forwards the payload unchanged (aside from `websiteId`), keeping `type: 'event'` but no longer forcing the `name` field.
- `layers/analytics/README.md` no longer references the removed pageview fallback.
