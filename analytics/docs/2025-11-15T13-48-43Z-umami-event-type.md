# Initial Prompt
I get this error from the Umami upstream when routing analytics through `/api/stats`: `{"error":{"message":"Bad request","code":"bad-request","status":400,"errors":[],"properties":{"type":{"errors":["Invalid option: expected one of \"event\"|\"identify\""]}}}}`. It looks like Umami dropped `pageview` types and only accepts `event`. Probably when there's no `name` field, it's treated as a page view. Update the analytics layer accordingly.

# Implementation Summary
Manual implementation; no automated code generator output was produced.

# Documentation Overview
- Normalized the analytics client so every payload sent to `/api/stats` is an Umami `event`, defaulting the `name` to `pageview` when none is provided.
- Hardened the `/api/stats` handler by removing the old type branching, forcing the upstream type to `event`, and ensuring payloads always include `website` plus a normalized `name`.
- Updated the README to document the behavior and captured this change log entry for future reference.

# Implementation Examples
- `layers/analytics/composables/useAnalytics.ts` now calls `sendPayload` which injects a `name` fallback and always posts `{ type: 'event', payload }` to the proxy.
- `layers/analytics/server/api/stats.post.ts` validates the body, fills in `websiteId`, normalizes the `name`, and forwards `type: 'event'` upstream regardless of the source call.
- `layers/analytics/README.md` notes that both page views and events flow through the event endpoint and how to control metadata via runtime config.
