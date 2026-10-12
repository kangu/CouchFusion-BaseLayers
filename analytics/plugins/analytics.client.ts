import type { DirectiveBinding } from "vue";
import { useRuntimeConfig } from "#imports";
import { createAnalyticsClient } from "../composables/useAnalytics";
import type { UmamiBindingValue } from "../types/umami";

type AnalyticsClient = ReturnType<typeof createAnalyticsClient>;

interface AnalyticsElement extends HTMLElement {
  __analyticsCleanup__?: () => void;
}

function bindDirective(
  el: AnalyticsElement,
  binding: DirectiveBinding<UmamiBindingValue>,
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

export default defineNuxtPlugin(async (nuxtApp) => {
  const tracker = createAnalyticsClient();
  const router = useRouter();
  const runtimeConfig = useRuntimeConfig();
  const publicAnalytics = runtimeConfig.public?.analytics ?? {};
  const umamiConfig = publicAnalytics.umami ?? {};
  tracker.init({
    endpoint: publicAnalytics.endpoint ?? undefined,
    websiteId: umamiConfig.websiteId ?? "",
    appName: umamiConfig.appName,
    includeTitle:
      typeof umamiConfig.includeTitle === "boolean"
        ? umamiConfig.includeTitle
        : true,
    sendReferrer:
      typeof umamiConfig.sendReferrer === "boolean"
        ? umamiConfig.sendReferrer
        : true,
    debug: Boolean(umamiConfig.debug),
    persistentId: publicAnalytics.persistentId === true,
    tag: typeof umamiConfig.tag === "string" && umamiConfig.tag ? umamiConfig.tag : undefined,
  });
  nuxtApp.provide("analytics", tracker);
  nuxtApp.provide("umami", tracker);

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
          void tracker.trackEvent("outbound-link-click", { url: url.href.slice(0, 200), domain: url.hostname });
        }
      },
      true,
    );
  }

  router.afterEach(async (to, from) => {
    void tracker.trackRouterNavigation(to, from).catch((err) => {
      // report if we are in dev mode
      if (import.meta.dev) console.warn("[analytics] nav track failed", err);
    });
  });
});
