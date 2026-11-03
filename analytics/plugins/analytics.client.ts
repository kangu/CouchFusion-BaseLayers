import type { DirectiveBinding } from "vue";
import { injectHead, useRuntimeConfig } from "#imports";
import { createAnalyticsClient } from "../composables/useAnalytics";
import type { AnalyticsBindingValue } from "../types/analytics";

type AnalyticsClient = ReturnType<typeof createAnalyticsClient>;

/** Longest wait for the new page's title before sending its pageview anyway. */
const TITLE_WAIT_MS = 300;

interface AnalyticsElement extends HTMLElement {
  __analyticsCleanup__?: () => void;
}

function bindDirective(
  el: AnalyticsElement,
  binding: DirectiveBinding<AnalyticsBindingValue>,
  client: AnalyticsClient,
) {
  cleanupDirective(el);

  const normalized = normalizeBinding(binding);
  if (!normalized) {
    return;
  }

  const { event, data, trigger } = normalized;
  const handler = () => client.trackEvent(event, data);

  el.addEventListener(trigger, handler);
  el.dataset.analyticsEvent = event;

  el.__analyticsCleanup__ = () => {
    el.removeEventListener(trigger, handler);
    if (el.dataset.analyticsEvent === event) {
      delete el.dataset.analyticsEvent;
    }
  };
}

function cleanupDirective(el: AnalyticsElement) {
  if (typeof el.__analyticsCleanup__ === "function") {
    el.__analyticsCleanup__();
    delete el.__analyticsCleanup__;
  }
}

function normalizeBinding(
  binding: DirectiveBinding<AnalyticsBindingValue>,
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

export default defineNuxtPlugin(async (nuxtApp) => {
  const tracker = createAnalyticsClient();
  const router = useRouter();
  const runtimeConfig = useRuntimeConfig();
  const publicAnalytics = runtimeConfig.public?.analytics ?? {};
  tracker.init({
    endpoint: publicAnalytics.endpoint ?? undefined,
    includeTitle: publicAnalytics.includeTitle !== false,
    sendReferrer: publicAnalytics.sendReferrer !== false,
    debug: publicAnalytics.debug === true,
    persistentId: publicAnalytics.persistentId === true,
    tag: typeof publicAnalytics.tag === "string" && publicAnalytics.tag ? publicAnalytics.tag : undefined,
  });
  nuxtApp.provide("analytics", tracker);

  // initialize v-analytics directive
  nuxtApp.vueApp.directive("analytics", {
    mounted(el, binding) {
      bindDirective(el as AnalyticsElement, binding, tracker);
    },
    updated(el, binding) {
      bindDirective(el as AnalyticsElement, binding, tracker);
    },
    beforeUnmount(el) {
      cleanupDirective(el as AnalyticsElement);
    },
  });

  // Opt-in auto-capture of outbound links and file downloads.
  const autoCapture = publicAnalytics.autoCapture ?? {};
  if (autoCapture.outbound || autoCapture.downloads) {
    const downloadPattern = new RegExp(
      `\\.(${String(autoCapture.downloadExtensions || "pdf,zip,dmg,exe,csv,xlsx,docx,pptx,mp3,mp4,gz,7z,rar,txt,json").split(",").map((ext: string) => ext.trim()).filter(Boolean).join("|")})$`,
      "i",
    );
    document.addEventListener(
      "click",
      (event) => {
        const anchor = (event.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
        if (!anchor) return;
        let url: URL;
        try {
          url = new URL(anchor.href, window.location.href);
        } catch {
          return;
        }
        if (!/^https?:$/.test(url.protocol)) return;
        if (autoCapture.downloads && downloadPattern.test(url.pathname)) {
          void tracker.trackEvent("file-download", { url: url.href.slice(0, 200), file: url.pathname.split("/").pop() });
        } else if (autoCapture.outbound && url.hostname !== window.location.hostname) {
          void tracker.trackEvent(typeof autoCapture.outboundEventName === "string" && autoCapture.outboundEventName.trim() ? autoCapture.outboundEventName.trim() : "outbound-link-click", { url: url.href.slice(0, 200), domain: url.hostname });
        }
      },
      true,
    );
  }

  // Router pageviews.
  // - Failed, aborted and duplicate navigations are skipped (the page didn't change).
  // - Hash-only changes are skipped unless `trackHashChanges` is on; query
  //   changes (pagination, filters) still count.
  // - The hit is sent once the new page's <title> is in the DOM (unhead's
  //   `dom:rendered`), with a short fallback for pages whose head didn't
  //   change. Sending right away would record the previous page's title.
  const trackHashChanges = publicAnalytics.trackHashChanges === true;
  const pageKey = (fullPath: string) => (trackHashChanges ? fullPath : fullPath.split("#")[0]);
  let lastTracked: string | null = null;
  let pending: { to: any; from: any; timer: ReturnType<typeof setTimeout> } | null = null;

  const flush = () => {
    if (!pending) return;
    const { to, from, timer } = pending;
    pending = null;
    clearTimeout(timer);
    void tracker.trackRouterNavigation(to, from).catch((err) => {
      if (import.meta.dev) console.warn("[analytics] nav track failed", err);
    });
  };

  try {
    injectHead(nuxtApp)?.hooks.hook("dom:rendered", flush);
  } catch {
    // No unhead instance: the timeout below still sends the pageview.
  }
  // Don't lose a pageview still waiting for its title when the tab closes.
  window.addEventListener("pagehide", flush);

  router.afterEach((to, from, failure) => {
    if (failure) return;
    const key = pageKey(to.fullPath);
    if (key === lastTracked) return;
    lastTracked = key;
    // A newer navigation sends the previous one first, so none is lost.
    flush();
    pending = { to, from, timer: setTimeout(flush, TITLE_WAIT_MS) };
  });
});
