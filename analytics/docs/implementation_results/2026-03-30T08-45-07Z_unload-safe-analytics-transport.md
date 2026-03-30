# Initial Prompt
Can we take down the waitForTrackingWithTimeout ms value from 150ms while still being sure the analytics event is tracked? The problem is that if the target website is slow to load, it looks like the site is hanging. Can we somehow work around that?

# Plan
1. Audit the current analytics transport to see whether page navigation can cancel in-flight events.
2. Add unload-safe browser transport primitives to the analytics client.
3. Preserve fallback behavior for environments where browser APIs are unavailable.
4. Add focused tests that verify the transport path selection.

# Implementation Summary
- Updated `layers/analytics/composables/useAnalytics.ts`:
  - added `buildRequestBody(...)` so event payloads are serialized once
  - added `dispatchBrowserPayload(...)` to prefer `navigator.sendBeacon(...)`
  - falls back to `fetch(..., { keepalive: true })` when `sendBeacon` is not available
  - preserves the awaited fallback `fetch` path for non-browser environments
- The client now dispatches browser analytics in a way that is substantially more resilient during page unload and full-page redirects.
- Added focused coverage from the consuming app test workspace in `apps/bitvocation/tests/analytics/analytics-transport.spec.ts` for:
  - `sendBeacon` dispatch
  - `keepalive` fetch fallback

# Verification
- Passed:
  - `./layers/node_modules/.bin/vitest --config layers/bitvocation-content.vitest.config.ts apps/bitvocation/tests/analytics/analytics-transport.spec.ts apps/bitvocation/tests/server/redirect-url.spec.ts --run`

# Next Steps
1. Optional: extend the analytics layer with a dedicated internal test config if you want analytics tests to live directly under `layers/analytics/tests`.
