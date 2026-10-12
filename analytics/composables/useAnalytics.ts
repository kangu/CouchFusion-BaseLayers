import { ref } from "vue";
import { useNuxtApp } from "#app";

export interface AnalyticsClientConfig {
  websiteId: string;
  endpoint: string;
  appName?: string;
  includeTitle: boolean;
  sendReferrer: boolean;
  debug: boolean;
  /** Opt-in first-party persistent id (localStorage); consent required. */
  persistentId: boolean;
  /** Optional tag attached to every hit (A/B variant, deploy, ...). */
  tag?: string;
}

const DEFAULT_CONFIG: AnalyticsClientConfig = {
  websiteId: "",
  endpoint: "/api/stats",
  appName: undefined,
  includeTitle: true,
  sendReferrer: true,
  debug: false,
  persistentId: false,
  tag: undefined,
};

const PERSISTENT_ID_KEY = "cfa.pid";

/** Reads (or creates) the opt-in first-party persistent id. */
function getPersistentId(): string | undefined {
  try {
    let id = localStorage.getItem(PERSISTENT_ID_KEY);
    if (!id) {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      id = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      localStorage.setItem(PERSISTENT_ID_KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
}


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

/**
 * Builds the analytics POST body once so multiple transports can reuse it.
 */
function buildRequestBody(payload: Record<string, any>, type = "event") {
  return JSON.stringify({ type, payload, sentAt: nowIso() });
}

/**
 * Sends analytics in a way that survives page unload when possible.
 */
function dispatchBrowserPayload(
  endpoint: string,
  body: string,
  debug: boolean,
) {
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const beaconPayload = new Blob([body], { type: "application/json" });
    const delivered = navigator.sendBeacon(endpoint, beaconPayload);

    if (!delivered && debug) {
      console.warn("[analytics] sendBeacon rejected payload");
    }

    if (delivered) {
      return true;
    }
  }

  if (typeof fetch === "undefined") return false;

  void fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
    keepalive: true,
  })
    .then(async (res) => {
      if (!res.ok && debug) {
        const text = await res.text().catch(() => "");
        console.warn("[analytics] backend error", res.status, text);
      }
    })
    .catch((error) => {
      if (debug) console.warn("[analytics] network error", error);
    });

  return true;
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
  let distinctId: string | undefined;

  async function sendPayload(payload: Record<string, any>, type = "event") {
    const body = buildRequestBody(payload, type);

    if (typeof window !== "undefined") {
      const dispatched = dispatchBrowserPayload(config.endpoint, body, config.debug);
      if (dispatched) return;
    }

    if (typeof fetch === "undefined") return;
    try {
      const res = await fetch(config.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body,
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
    if (config.tag) payload.tag = config.tag;
    if (distinctId) payload.id = distinctId;
    if (config.persistentId) {
      const pid = getPersistentId();
      if (pid) payload.pid = pid;
    }

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

  /**
   * Associates subsequent hits with an app-level id (e.g. logged-in user) and
   * stores optional session properties. Mirrors `umami.identify()`.
   */
  async function identify(id?: string | Record<string, any>, data: Record<string, any> = {}) {
    if (id && typeof id === "object") {
      data = id;
      id = undefined;
    }
    if (typeof id === "string" && id.trim()) distinctId = id.trim();
    await sendPayload(buildBasePayload({ data }), "identify");
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
    identify,
    isLoaded,
    getInstance: () => null,
  };
}

export function useAnalytics() {
  const nuxtApp = useNuxtApp();
  return nuxtApp.$analytics ?? createAnalyticsClient();
}
