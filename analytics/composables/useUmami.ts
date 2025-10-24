import { useNuxtApp } from "#imports";

import type { UmamiClient } from "../types/umami";

/**
 * Returns the shared Umami analytics client.
 *
 * Usage:
 * ```ts
 * const umami = useUmami();
 * umami.track('signup-click', { plan: 'pro' });
 * ```
 */
export const useUmami = (): UmamiClient => {
  const nuxtApp = useNuxtApp();
  return nuxtApp.$umami;
};
