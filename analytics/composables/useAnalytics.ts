import { ref } from "vue";
import { useNuxtApp } from "#app";

export interface AnalyticsClientConfig {
  websiteId: string;
  endpoint: string;
  appName?: string;
  includeTitle: boolean;
  sendReferrer: boolean;
  debug: boolean;
}

const DEFAULT_CONFIG: AnalyticsClientConfig = {
  websiteId: "",
  endpoint: "/api/stats",
  appName: undefined,
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

function normalizeEndpoint(value?: string) {
  if (!value) return DEFAULT_CONFIG.endpoint;
  return value.trim().length > 0 ? value : DEFAULT_CONFIG.endpoint;
}

export function createAnalyticsClient(
  initialConfig: Partial<AnalyticsClientConfig> = {},
) {
  let config: AnalyticsClientConfig = {
    ...DEFAULT_CONFIG,
    ...initialConfig,
    endpoint: normalizeEndpoint(initialConfig.endpoint),
  };
  const isLoaded = ref(true);

  async function sendPayload(payload: Record<string, any>) {
    if (typeof fetch === "undefined") return;
    try {
      const res = await fetch(config.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: "event", payload, sentAt: nowIso() }),
      });
      if (!res.ok && config.debug) {
        const text = await res.text().catch(() => "");
        console.warn("[analytics] backend error", res.status, text);
      }
    } catch (error) {
      if (config.debug) console.warn("[analytics] network error", error);
    }
  }

  function init(opts: Partial<AnalyticsClientConfig> = {}) {
    config = {
      ...config,
      ...opts,
      endpoint: normalizeEndpoint(opts.endpoint ?? config.endpoint),
    };
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

    if (config.sendReferrer && c.referrer) payload.referrer = c.referrer;
    if (config.includeTitle && c.title) payload.title = c.title;
    if (config.appName) payload.appName = config.appName;
    if (config.websiteId) payload.website = config.websiteId;

    return { ...payload, ...overrides };
  }

  // Simulate full pageview
  async function trackPageview(extra = {}) {
    const payload = buildBasePayload(extra);
    await sendPayload(payload);
  }

  // Arbitrary events
  // name: string, data: object (optional), extra fields override base payload if needed
  async function trackEvent(name, data = {}, extra = {}) {
    const payload = buildBasePayload({
      name,
      data,
      ...extra,
    });
    await sendPayload(payload);
  }

  async function track(name, data = {}, extra = {}) {
    return trackEvent(name, data, extra);
  }

  async function trackView(url?: string, referrer?: string) {
    const overrides: Record<string, any> = {};
    if (url) overrides.url = url;
    if (referrer) overrides.referrer = referrer;
    return trackPageview(overrides);
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
    track,
    trackView,
    isLoaded,
    getInstance: () => null,
  };
}

export function useAnalytics() {
  const nuxtApp = useNuxtApp();
  return nuxtApp.$analytics ?? createAnalyticsClient();
}
