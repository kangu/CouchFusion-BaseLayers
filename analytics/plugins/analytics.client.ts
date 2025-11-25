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

  router.afterEach(async (to, from) => {
    void tracker.trackRouterNavigation(to, from).catch((err) => {
      // report if we are in dev mode
      if (import.meta.dev) console.warn("[analytics] nav track failed", err);
    });
  });
});
