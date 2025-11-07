# Initial Prompt
Address the repeated `[analytics] umami.trackView called before script loaded` warnings triggered by the Bitvocation console when the analytics layer enables manual route tracking with excluded paths.

# Implementation Summary
Manual tracking now waits for Umami's `track/trackView` to exist by gating the `isLoaded` flag with a readiness check and polling after the script loads, eliminating early `trackView` calls.

# Documentation Overview
- Added explicit readiness helpers that treat the Umami client as "loaded" only when both `track` and `trackView` functions are defined, preventing premature pageview sends when the script tag exists but the API is still booting.
- Updated `ensureScriptLoaded` so existing tracker tags trigger the same readiness checks and new loads poll the client until it is callable, logging a dev warning if the API never becomes available.
- Manual tracking watchers now rely on the stricter `isLoaded` signal, so excluded-path routing waits until the SDK can safely emit events.

# Implementation Examples
- `layers/analytics/plugins/umami.client.ts`
  ```ts
  const isLoaded = ref(process.client && isUmamiClientReady())
  ...
  if (existingScript) {
    if (isUmamiClientReady()) {
      isLoaded.value = true
    } else {
      waitForClientReady(isLoaded)
    }
    return
  }
  ```
- `layers/analytics/plugins/umami.client.ts`
  ```ts
  const waitForClientReady = (isLoaded: { value: boolean }) => {
    if (!process.client || isLoaded.value) return

    let attempts = 0
    const tick = () => {
      if (isUmamiClientReady()) {
        isLoaded.value = true
        return
      }
      attempts += 1
      if (attempts < MAX_CLIENT_READY_ATTEMPTS) {
        setTimeout(tick, CLIENT_READY_RETRY_DELAY)
      } else if (process.dev) {
        console.warn('[analytics] Umami script loaded but client API is still unavailable.')
      }
    }

    tick()
  }
  ```
