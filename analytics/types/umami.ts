import type { Ref } from "vue";

export interface UmamiClient {
  init: (config?: Record<string, any>) => void;
  trackPageview: (extra?: Record<string, any>) => Promise<void>;
  trackEvent: (
    event: string,
    data?: Record<string, any>,
    extra?: Record<string, any>,
  ) => Promise<void>;
  trackRouterNavigation: (to: any, from: any) => Promise<void>;
  track: (
    event: string,
    data?: Record<string, any>,
    extra?: Record<string, any>,
  ) => Promise<void>;
  trackView: (url?: string, referrer?: string) => Promise<void>;
  isLoaded: Ref<boolean>;
  getInstance: () => any;
}

export type UmamiBindingValue =
  | string
  | {
      event: string;
      data?: Record<string, any>;
      trigger?: string;
    };
