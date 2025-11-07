# Initial Prompt
The analytics system doesn't seem to work properly. The /script.js is loaded for http://localhost:3012/, but navigating to /pow-lab or /about don't trigger the /api/send request that Umami does. Place console logs through the umami.client.ts to see which parts are executed and which not. Consider simplifying the umami.client.ts. The implementation should be simple and straight-forward. Use the playwright MCP server to render and test the site.

# Implementation Summary
Instrumented the Umami client plugin with detailed logging, simplified readiness handling, and added a track() fallback so manual page views now fire /api/send requests when navigating across routes.

# Documentation Overview
- Added a lightweight logging helper plus readiness queue so the plugin now reports script injection, router events, and when the global Umami API becomes usable.
- Relaxed the readiness check to require only `umami.track`, and introduced a fallback that rewrites manual `trackView` calls to `track` when the upstream script omits `trackView`.
- Simplified manual tracking by queuing page views until the client is ready, normalizing URLs/referrers, and persisting the last routed URL so `/pow-lab` and `/about` emit `/api/send` fetches.

# Implementation Examples
- `layers/analytics/plugins/umami.client.ts`
  ```ts
  const log = (...args: unknown[]) => {
    console.info("[analytics]", ...args)
  }
  ...
  const invokeTrackView = (client: Record<string, any>, url?: string, referrer?: string) => {
    if (typeof client.trackView === 'function') {
      client.trackView(url, referrer)
      return
    }

    if (typeof client.track === 'function') {
      client.track((base: Record<string, any>) => ({
        ...base,
        ...(url ? { url } : {}),
        ...(referrer ? { referrer } : {})
      }))
      return
    }

    log('Unable to send manual page view; Umami client missing track methods.')
  }
  ```
- `layers/analytics/plugins/umami.client.ts`
  ```ts
  const emitView = (fullPath: string, path: string) => {
    if (isExcludedPath(path)) {
      log('Skipping manual page view for excluded path', { path })
      return
    }

    const absoluteUrl = toAbsoluteUrl(fullPath) ?? fullPath
    const referrer = state.lastTrackedUrl ?? (typeof document !== 'undefined' ? document.referrer : undefined)
    const send = () => {
      log('Tracking manual page view', { url: absoluteUrl, referrer })
      client.trackView(absoluteUrl, referrer)
      state.lastTrackedUrl = absoluteUrl
    }

    if (isLoaded.value) {
      send()
      return
    }

    log('Queueing manual page view until client ready', { fullPath })
    queueUntilReady(send, isLoaded)
  }
  ```
- Playwright MCP run against `http://localhost:3012` now logs `umami.trackView { url: http://localhost:3012/pow-lab, referrer: ... }` and the browser console surfaces `/api/send` 404 responses, confirming the POSTs fire when routing between `/`, `/pow-lab`, and `/about`.
