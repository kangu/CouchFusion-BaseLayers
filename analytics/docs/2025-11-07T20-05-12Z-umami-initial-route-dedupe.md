# Initial Prompt
Investigate why the Bitvocation console still shows two manual `trackView` calls on the initial route load despite the previous instrumentation, and adjust `umami.client.ts` so navigating to `/`, `/pow-lab`, or `/about` only emits a single `/api/send` request per route.

# Implementation Summary
Manual tracking now tracks the last queued and last sent path so the initial route only emits once; duplicate events with identical URL/referrer pairs are ignored while subsequent real navigations still post to `/api/send`.

# Documentation Overview
- Extended the manual tracking state with `pendingFullPath` and added a duplicate guard so we no longer enqueue the same path twice before Umami is ready.
- Added a second guard that skips manual page views where both `url` and `referrer` equal the last tracked value—this handles the initial Nuxt route-change echo while still allowing genuine revisits (where the referrer differs) to fire.
- Re-ran the Playwright MCP flow over `/`, `/pow-lab`, and `/about` to confirm the console now shows “Ignoring duplicate manual page view” for the initial route and single `/api/send` attempts for subsequent navigations.

# Implementation Examples
- `layers/analytics/plugins/umami.client.ts`
  ```ts
  const manualTrackingState = {
    lastTrackedUrl: null as string | null,
    pendingFullPath: null as string | null,
  }
  ...
  if (state.pendingFullPath === fullPath && !isLoaded.value) {
    log('Manual page view already queued for', { fullPath })
    return
  }
  ...
  if (isLoaded.value && absoluteUrl === state.lastTrackedUrl && referrer === absoluteUrl) {
    log('Ignoring duplicate manual page view for', { fullPath })
    return
  }
  ```
- Playwright console excerpt:
  ```text
  [analytics] Tracking manual page view {url: http://localhost:3012/, referrer: }
  [analytics] umami.trackView {url: http://localhost:3012/, referrer: undefined}
  [analytics] Route change detected {fullPath: /, path: /}
  [analytics] Ignoring duplicate manual page view for {fullPath: /}
  ```
