let _config = {
  websiteId: "", // REQUIRED: your Umami website UUID
  endpoint: "/api/stats",
  // optional defaults
  appName: undefined, // e.g. 'my-frontend', appears in UA if you want
  includeTitle: true,
  sendReferrer: true,
  debug: false,
};

function nowIso() {
  return new Date().toISOString();
}

function getClientInfo() {
  if (typeof window === "undefined") return {};
  const { width, height } = window.screen || {};
  const screen = width && height ? `${width}x${height}` : "0x0";
  const language = navigator.language || navigator.userLanguage || "en-US";
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const url =
    window.location.pathname + window.location.search + window.location.hash;
  const hostname = window.location.hostname;
  const referrer = document.referrer || undefined;
  const title = document.title || undefined;

  return {
    url,
    hostname,
    language,
    screen,
    timezone: tz,
    referrer,
    title,
  };
}

async function sendToBackend({ type, payload }) {
  try {
    const res = await fetch(_config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // DO NOT set X-Forwarded-For here; the browser can’t set it reliably.
        // The backend will take care of IP + UA preservation.
      },
      body: JSON.stringify({ type, payload, sentAt: nowIso() }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (_config.debug)
        console.warn("[umami] backend error", res.status, text);
    }
  } catch (e) {
    if (_config.debug) console.warn("[umami] network error", e);
  }
}

export function useAnalytics() {
  function init(opts = {}) {
    _config = { ..._config, ...opts };
  }

  function buildBasePayload(overrides = {}) {
    const c = getClientInfo();
    const payload = {
      url: c.url,
      hostname: c.hostname,
      language: c.language,
      screen: c.screen,
      timezone: c.timezone,
    };

    if (_config.sendReferrer && c.referrer) payload.referrer = c.referrer;
    if (_config.includeTitle && c.title) payload.title = c.title;

    return { ...payload, ...overrides };
  }

  // Simulate full pageview
  async function trackPageview(extra = {}) {
    const payload = buildBasePayload(extra);
    await sendToBackend({ type: "event", payload });
  }

  // Arbitrary events
  // name: string, data: object (optional), extra fields override base payload if needed
  async function trackEvent(name, data = {}, extra = {}) {
    const payload = buildBasePayload({
      name,
      data,
      ...extra,
    });
    await sendToBackend({ type: "event", payload });
  }

  // Helper for SPA route changes (use afterEach in router)
  async function trackRouterNavigation(to, from) {
    // let callers decide whether to filter
    await trackPageview({
      url: to.fullPath || to.path || getClientInfo().url,
    });
  }

  return {
    init,
    trackPageview,
    trackEvent,
    trackRouterNavigation,
  };
}
