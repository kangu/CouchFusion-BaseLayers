# Initial Prompt
I am trying to proxy /script.js to the Umami script, but the browser refuses to execute it because the response is served as `application/json`. The proxy is handled inside `layers/analytics/plugins/umami.client.ts`, so fix the logic there.

# Implementation Summary
When the configured script URL is relative (e.g., `/script.js`), the analytics plugin now fetches the upstream Umami script itself, wraps it in a `Blob` with `text/javascript`, and injects that object URL so the browser executes it without MIME errors; an optional `scriptProxyUrl` config can override the upstream source.

# Documentation Overview
- Added a `scriptProxyUrl` option and detection for relative script paths so we automatically fetch the real Umami script (defaulting to `https://analytics.umami.is/script.js`) and serve it via an object URL with the proper MIME type.
- Centralized logging so we know whether the script was loaded directly or via the proxy, and ensured object URLs are revoked on both load and error for cleanliness.
- Left the dataset-driven configuration intact so the proxied script still posts analytics to the local `/api/send` endpoint while its code executes from the correct MIME context.

# Implementation Examples
- `layers/analytics/plugins/umami.client.ts`
  ```ts
  const shouldProxyScript = scriptUrl.startsWith("/") || scriptUrl.startsWith("./") || scriptUrl.startsWith("../")
  const proxySourceUrl = options.scriptProxyUrl?.trim() || (shouldProxyScript ? `${DEFAULT_HOST}${DEFAULT_SCRIPT_PATH}` : undefined)

  if (proxySourceUrl) {
    fetch(proxySourceUrl)
      .then((response) => response.text())
      .then((code) => {
        proxiedObjectUrl = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))
        attachScript(proxiedObjectUrl, true)
      })
      .catch(() => attachScript(scriptUrl, false))
  } else {
    attachScript(scriptUrl, false)
  }
  ```
- The injected script element still carries all the same `data-*` attributes so Umami gets its `websiteId`, `hostUrl`, `data-domains`, etc., even though the bytes originated from the upstream host.
