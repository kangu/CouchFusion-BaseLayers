import { useAnalytics } from "../composables/useAnalytics";

interface UmamiElement extends HTMLElement {
  __umamiCleanup__?: () => void;
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
  const handler = () => client.trackEvent(event, data);

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

export default defineNuxtPlugin(async (nuxtApp) => {
  const tracker = useAnalytics();
  const router = useRouter();

  tracker.init({});

  // initialize v-analytics directive
  nuxtApp.vueApp.directive("umami", {
    mounted(el, binding) {
      bindDirective(el as UmamiElement, binding, tracker);
    },
    updated(el, binding) {
      bindDirective(el as UmamiElement, binding, tracker);
    },
    beforeUnmount(el) {
      cleanupDirective(el as UmamiElement);
    },
  });

  router.afterEach(async (to, from) => {
    await tracker.trackRouterNavigation(to, from);
  });
});
