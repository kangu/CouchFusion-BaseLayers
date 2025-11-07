import { readonly, ref } from "vue";
import type { DirectiveBinding } from "vue";
import type { Router } from "vue-router";

import { useRuntimeConfig } from "#imports";
import type { UmamiBindingValue, UmamiClient } from "../types/umami";

const SCRIPT_ID = "umami-tracker";
const DEFAULT_HOST = "https://analytics.umami.is";
const DEFAULT_SCRIPT_PATH = "/script.js";

interface RuntimeUmamiConfig {
  websiteId?: string;
  hostUrl?: string;
  scriptPath?: string;
  dataDomains?: string;
  autoTrack?: boolean;
  excludedPaths?: string | string[];
}

interface UmamiElement extends HTMLElement {
  __umamiCleanup__?: () => void;
}

type ReadyCallback = () => void;

const CLIENT_READY_RETRY_DELAY = 75;

const log = (...args: unknown[]) => {
  // console.info("[analytics]", ...args);
};

const readyState: {
  callbacks: ReadyCallback[];
  timer: ReturnType<typeof setTimeout> | null;
} = {
  callbacks: [],
  timer: null,
};

const isUmamiClientReady = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  const client = (globalThis as any).umami;
  return Boolean(client && typeof client.track === "function");
};

const flushReadyCallbacks = () => {
  const pending = [...readyState.callbacks];
  readyState.callbacks.length = 0;
  for (const callback of pending) {
    try {
      callback();
    } catch (error) {
      console.error("[analytics] ready callback failed", error);
    }
  }
};

const markClientReady = (isLoaded: { value: boolean }) => {
  if (isLoaded.value) {
    flushReadyCallbacks();
    return;
  }

  isLoaded.value = true;
  log("Umami client ready");

  if (readyState.timer) {
    clearTimeout(readyState.timer);
    readyState.timer = null;
  }

  flushReadyCallbacks();
};

const queueUntilReady = (
  callback: ReadyCallback,
  isLoaded: { value: boolean },
) => {
  if (isLoaded.value) {
    callback();
    return;
  }

  readyState.callbacks.push(callback);
};

const ensureClientReadyPolling = (isLoaded: { value: boolean }) => {
  if (!process.client) {
    return;
  }

  if (isUmamiClientReady()) {
    markClientReady(isLoaded);
    return;
  }

  if (readyState.timer !== null) {
    return;
  }

  const poll = () => {
    if (isUmamiClientReady()) {
      markClientReady(isLoaded);
      return;
    }

    readyState.timer = setTimeout(poll, CLIENT_READY_RETRY_DELAY);
  };

  readyState.timer = setTimeout(poll, CLIENT_READY_RETRY_DELAY);
};

const ensureClientReadiness = (isLoaded: { value: boolean }) => {
  if (isUmamiClientReady()) {
    markClientReady(isLoaded);
  } else {
    ensureClientReadyPolling(isLoaded);
  }
};

const toAbsoluteUrl = (path: string | undefined): string | undefined => {
  if (!path) {
    return undefined;
  }

  if (typeof window === "undefined") {
    return path;
  }

  try {
    return new URL(path, window.location.origin).toString();
  } catch {
    return path;
  }
};

const invokeTrackView = (
  client: Record<string, any>,
  url?: string,
  referrer?: string,
) => {
  if (typeof client.trackView === "function") {
    client.trackView(url, referrer);
    return;
  }

  if (typeof client.track === "function") {
    client.track((base: Record<string, any>) => ({
      ...base,
      ...(url ? { url } : {}),
      ...(referrer ? { referrer } : {}),
    }));
    return;
  }

  log("Unable to send manual page view; Umami client missing track methods.");
};

export default defineNuxtPlugin((nuxtApp) => {
  const runtimeConfig = useRuntimeConfig();
  const options: RuntimeUmamiConfig =
    runtimeConfig.public?.analytics?.umami ?? {};

  const websiteId = options.websiteId?.trim();
  const hostUrl = options.hostUrl?.trim() || DEFAULT_HOST;
  const scriptPath = options.scriptPath?.trim() || DEFAULT_SCRIPT_PATH;
  const scriptUrl = `${hostUrl.replace(/\/$/, "")}${
    scriptPath.startsWith("/") ? scriptPath : `/${scriptPath}`
  }`;
  const excludedPaths = normalizeExcludedPaths(options.excludedPaths);
  const isLoaded = ref(process.client && isUmamiClientReady());
  let manualTracking = false;
  let manualTrackingRouter: Router | null = null;
  const manualTrackingState = {
    lastTrackedUrl: null as string | null,
    pendingFullPath: null as string | null,
  };

  if (process.client) {
    if (websiteId) {
      manualTracking = shouldManualTrack(excludedPaths, options.autoTrack);

      log("Initializing Umami", {
        websiteId,
        hostUrl,
        scriptPath,
        manualTracking,
        autoTrack: options.autoTrack,
        excludedPaths,
      });

      ensureScriptLoaded(
        websiteId,
        scriptUrl,
        options,
        manualTracking,
        isLoaded,
      );

      if (manualTracking) {
        manualTrackingRouter = nuxtApp.$router;
        if (!manualTrackingRouter && process.dev) {
          log("Router instance not available; manual tracking disabled.");
        } else if (process.dev) {
          log("Manual page tracking enabled", { excludedPaths });
        }
      }
    } else {
      log(
        "runtimeConfig.public.analytics.umami.websiteId is missing. Analytics disabled.",
      );
    }
  }

  const getInstance = () => (globalThis as any).umami;

  const track: UmamiClient["track"] = (event, data) => {
    const client = getInstance();
    if (!client || typeof client.track !== "function") {
      log("umami.track not ready", { event });
      return;
    }

    log("umami.track", { event, data });
    client.track(event, data);
  };

  const trackView: UmamiClient["trackView"] = (url, referrer) => {
    const client = getInstance();
    if (!client || typeof client.track !== "function") {
      log("umami.trackView not ready", { url, referrer });
      return;
    }

    const normalizedUrl = toAbsoluteUrl(url);
    const normalizedReferrer = toAbsoluteUrl(referrer);
    log("umami.trackView", {
      url: normalizedUrl,
      referrer: normalizedReferrer,
    });
    invokeTrackView(client, normalizedUrl, normalizedReferrer);
  };

  const client: UmamiClient = {
    isLoaded: readonly(isLoaded),
    track,
    trackView,
    getInstance,
  };

  const clientRef = client;

  nuxtApp.provide("umami", clientRef);

  if (manualTracking && manualTrackingRouter) {
    setupManualPageTracking(
      manualTrackingRouter,
      clientRef,
      excludedPaths,
      isLoaded,
      manualTrackingState,
    );
  }

  nuxtApp.vueApp.directive("umami", {
    mounted(el, binding) {
      bindDirective(el as UmamiElement, binding, clientRef);
    },
    updated(el, binding) {
      bindDirective(el as UmamiElement, binding, clientRef);
    },
    beforeUnmount(el) {
      cleanupDirective(el as UmamiElement);
    },
  });
});

function ensureScriptLoaded(
  websiteId: string,
  scriptUrl: string,
  options: RuntimeUmamiConfig,
  manualTracking: boolean,
  isLoaded: { value: boolean },
) {
  const existingScript = document.getElementById(SCRIPT_ID);
  if (existingScript) {
    log("Existing Umami script detected, reusing tag.");
    ensureClientReadiness(isLoaded);
    return;
  }

  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.async = true;
  script.defer = true;
  script.src = scriptUrl;
  script.dataset.websiteId = websiteId;
  script.dataset.umami = "true";

  if (options.hostUrl) {
    script.setAttribute("data-host-url", options.hostUrl);
  }
  const autoTrack = manualTracking ? false : (options.autoTrack ?? true);

  if (!autoTrack) {
    script.setAttribute("data-auto-track", "false");
  }
  if (options.dataDomains) {
    script.setAttribute("data-domains", options.dataDomains);
  }

  script.addEventListener("load", () => {
    log("Umami script loaded");
    ensureClientReadiness(isLoaded);
  });

  script.addEventListener("error", (event) => {
    console.error(
      `[analytics] Failed to load Umami analytics script from ${scriptUrl}`,
      event,
    );
  });

  log("Injecting Umami script", { scriptUrl, manualTracking, autoTrack });
  document.head.appendChild(script);
}

function shouldManualTrack(
  excludedPaths: string[],
  autoTrackOption: boolean | undefined,
) {
  if (autoTrackOption === false) {
    return true;
  }

  return excludedPaths.length > 0;
}

function bindDirective(
  el: UmamiElement,
  binding: DirectiveBinding<UmamiBindingValue>,
  client: UmamiClient,
) {
  cleanupDirective(el);

  const normalized = normalizeBinding(binding);
  if (!normalized) {
    return;
  }

  const { event, data, trigger } = normalized;
  const handler = () => client.track(event, data);

  el.addEventListener(trigger, handler);
  el.dataset.umamiEvent = event;

  el.__umamiCleanup__ = () => {
    el.removeEventListener(trigger, handler);
    if (el.dataset.umamiEvent === event) {
      delete el.dataset.umamiEvent;
    }
  };
}

function cleanupDirective(el: UmamiElement) {
  if (typeof el.__umamiCleanup__ === "function") {
    el.__umamiCleanup__();
    delete el.__umamiCleanup__;
  }
}

function normalizeBinding(
  binding: DirectiveBinding<UmamiBindingValue>,
): { event: string; data?: Record<string, any>; trigger: string } | null {
  const value = binding.value;

  if (!value) {
    return null;
  }

  const triggerFromArg =
    binding.arg && binding.arg.length > 0 ? binding.arg : undefined;

  if (typeof value === "string") {
    const event = value.trim();
    if (!event) {
      return null;
    }

    return {
      event,
      trigger: triggerFromArg ?? "click",
    };
  }

  if (typeof value === "object" && typeof value.event === "string") {
    const event = value.event.trim();
    if (!event) {
      return null;
    }

    return {
      event,
      data: value.data,
      trigger: value.trigger ?? triggerFromArg ?? "click",
    };
  }

  return null;
}

function normalizeExcludedPaths(
  value: string | string[] | undefined,
): string[] {
  if (!value) {
    return [];
  }

  const list = Array.isArray(value)
    ? value
    : value.split(",").map((entry) => entry.trim());

  return list.filter((entry) => entry.length > 0);
}

function createExclusionMatcher(patterns: string[]) {
  if (patterns.length === 0) {
    return () => false;
  }

  const normalized = patterns.map((pattern) => pattern.trim());

  return (path: string) => {
    return normalized.some((pattern) => {
      if (!pattern) return false;
      if (pattern.endsWith("*")) {
        const prefix = pattern.slice(0, -1);
        return path.startsWith(prefix);
      }
      return path === pattern;
    });
  };
}

function setupManualPageTracking(
  router: Router,
  client: UmamiClient,
  excludedPaths: string[],
  isLoaded: { value: boolean },
  state: { lastTrackedUrl: string | null; pendingFullPath: string | null },
) {
  const isExcludedPath = createExclusionMatcher(excludedPaths);

  const emitView = (fullPath: string, path: string) => {
    if (isExcludedPath(path)) {
      log("Skipping manual page view for excluded path", { path });
      return;
    }

    if (state.pendingFullPath === fullPath && !isLoaded.value) {
      log("Manual page view already queued for", { fullPath });
      return;
    }

    const absoluteUrl = toAbsoluteUrl(fullPath) ?? fullPath;
    const referrer =
      state.lastTrackedUrl ??
      (typeof document !== "undefined" ? document.referrer : undefined);

    if (
      isLoaded.value &&
      absoluteUrl === state.lastTrackedUrl &&
      referrer === absoluteUrl
    ) {
      log("Ignoring duplicate manual page view for", { fullPath });
      return;
    }
    const send = () => {
      log("Tracking manual page view", { url: absoluteUrl, referrer });
      client.trackView(absoluteUrl, referrer);
      state.lastTrackedUrl = absoluteUrl;
      state.pendingFullPath = null;
    };

    if (isLoaded.value) {
      send();
      return;
    }

    log("Queueing manual page view until client ready", { fullPath });
    state.pendingFullPath = fullPath;
    queueUntilReady(send, isLoaded);
  };

  // initial navigation
  const currentRoute = router.currentRoute.value;
  log("Emitting initial manual page view", {
    fullPath: currentRoute.fullPath,
    path: currentRoute.path,
  });
  emitView(currentRoute.fullPath, currentRoute.path);

  router.afterEach((to) => {
    log("Route change detected", { fullPath: to.fullPath, path: to.path });
    emitView(to.fullPath, to.path);
  });
}
