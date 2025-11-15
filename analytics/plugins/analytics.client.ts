import type { DirectiveBinding } from "vue";
import { useAnalytics } from "../composables/useAnalytics";
import type { UmamiBindingValue } from "../types/umami";

type AnalyticsClient = ReturnType<typeof useAnalytics>;

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
  const tracker = useAnalytics();
  const router = useRouter();

  tracker.init({});
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
    await tracker.trackRouterNavigation(to, from);
  });
});
