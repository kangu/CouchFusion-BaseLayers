import { defineNuxtPlugin, useRoute } from "#app";
import {
  createAnalyticsClient,
  useAnalytics,
} from "../composables/useAnalytics";

type TrackedElement = {
  el: HTMLElement;
  id: string;
  key: string;
};

const STORAGE_KEY = "component-analytics-seen";

function loadSeen(): Record<string, boolean> {
  if (typeof sessionStorage === "undefined") return {};
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function saveSeen(seen: Record<string, boolean>) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
  } catch {
    /* ignore */
  }
}

function buildKey(path: string, id: string) {
  return `${path}::${id}`;
}

export default defineNuxtPlugin((nuxtApp) => {
  if (process.server) return;

  const route = useRoute();
  const analytics = useAnalytics() ?? createAnalyticsClient();
  let seen = loadSeen();
  let observer: IntersectionObserver | null = null;
  let mutationObserver: MutationObserver | null = null;
  let mutationTimeout: ReturnType<typeof setTimeout> | null = null;

  const handleIntersect: IntersectionObserverCallback = (entries) => {
    entries.forEach((entry) => {
      const target = entry.target as HTMLElement;
      const id = target.getAttribute("id") || target.dataset.analyticsId;
      const track = target.dataset.analyticsTrack;
      if (!id || track !== "true") return;

      const key = buildKey(route.fullPath || window.location.pathname, id);
      if (seen[key]) return;

      if (entry.isIntersecting) {
        const payload = {
          name: "component_view:" + id,
          data: {
            // id,
            path: route.fullPath || window.location.pathname,
          },
        };
        analytics.trackEvent?.(payload.name, payload.data);
        seen[key] = true;
        saveSeen(seen);
      }
    });
  };

  const scan = () => {
    if (observer) observer.disconnect();
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>('[data-analytics-track="true"]'),
    );
    if (!elements.length) return;

    observer = new IntersectionObserver(handleIntersect, {
      root: null,
      threshold: 0.15,
    });
    elements.forEach((el) => observer?.observe(el));
  };

  const scheduleScan = () => {
    if (mutationTimeout) clearTimeout(mutationTimeout);
    mutationTimeout = setTimeout(scan, 200);
  };

  nuxtApp.hook("page:finish", () => {
    scheduleScan();
  });

  mutationObserver = new MutationObserver(scheduleScan);
  mutationObserver.observe(document.body, { childList: true, subtree: true });

  // initial
  scheduleScan();

  nuxtApp.hook("app:beforeDestroy", () => {
    observer?.disconnect();
    mutationObserver?.disconnect();
    if (mutationTimeout) clearTimeout(mutationTimeout);
  });
});
