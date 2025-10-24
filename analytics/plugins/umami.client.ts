import { readonly, ref, watch } from "vue";
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

export default defineNuxtPlugin((nuxtApp) => {
  const runtimeConfig = useRuntimeConfig();
  const options: RuntimeUmamiConfig =
    runtimeConfig.public?.analytics?.umami ?? {};

  const websiteId = options.websiteId?.trim();
  const hostUrl = options.hostUrl?.trim() || DEFAULT_HOST;
  const scriptPath = options.scriptPath?.trim() || DEFAULT_SCRIPT_PATH;
  const scriptUrl = `${hostUrl.replace(/\/$/, "")}${scriptPath.startsWith("/") ? scriptPath : `/${scriptPath}`}`;
  const excludedPaths = normalizeExcludedPaths(options.excludedPaths);
  const isLoaded = ref(
    typeof window !== "undefined" &&
      typeof (globalThis as any).umami === "object",
  );
  let manualTracking = false;
  let manualTrackingRouter: Router | null = null;

  if (process.client) {
    if (websiteId) {
      manualTracking = shouldManualTrack(excludedPaths, options.autoTrack);

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
          console.warn(
            "[analytics] Router instance not available; manual tracking disabled.",
          );
        } else if (process.dev) {
          console.info(
            "[analytics] Manual page tracking enabled with excluded paths",
          );
        }
      }
    } else {
      console.warn(
        "[analytics] runtimeConfig.public.analytics.umami.websiteId is missing. Umami analytics is disabled.",
      );
    }
  }

  const getInstance = () => (globalThis as any).umami;

  const track: UmamiClient["track"] = (event, data) => {
    const client = getInstance();
    if (!client || typeof client.track !== "function") {
      if (process.dev) {
        console.warn("[analytics] umami.track called before script loaded", {
          event,
        });
      }
      return;
    }

    client.track(event, data);
  };

  const trackView: UmamiClient["trackView"] = (url, referrer) => {
    const client = getInstance();
    if (!client || typeof client.trackView !== "function") {
      if (process.dev) {
        console.warn(
          "[analytics] umami.trackView called before script loaded",
          { url, referrer },
        );
      }
      return;
    }

    client.trackView(url, referrer);
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
  if (document.getElementById(SCRIPT_ID)) {
    if (typeof (globalThis as any).umami === "object") {
      isLoaded.value = true;
    }
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
    if (typeof (globalThis as any).umami === "object") {
      isLoaded.value = true;
    }
  });

  script.addEventListener("error", (event) => {
    console.error(
      `[analytics] Failed to load Umami analytics script from ${scriptUrl}`,
      event,
    );
  });

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
) {
  const isExcludedPath = createExclusionMatcher(excludedPaths);

  const emitView = (fullPath: string, path: string) => {
    if (isExcludedPath(path)) {
      return;
    }

    const send = () => client.trackView(fullPath);

    if (isLoaded.value) {
      send();
      return;
    }

    const stop = watch(
      () => isLoaded.value,
      (ready) => {
        if (ready) {
          send();
          stop();
        }
      },
    );
  };

  // initial navigation
  const currentRoute = router.currentRoute.value;
  emitView(currentRoute.fullPath, currentRoute.path);

  router.afterEach((to) => {
    emitView(to.fullPath, to.path);
  });
}
