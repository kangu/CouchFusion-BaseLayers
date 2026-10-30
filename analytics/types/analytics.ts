import type { Ref } from "vue";

export interface AnalyticsClient {
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
  identify: (id?: string | Record<string, any>, data?: Record<string, any>) => Promise<void>;
  isLoaded: Ref<boolean>;
  getInstance: () => any;
}

export type AnalyticsBindingValue =
  | string
  | {
      event: string;
      data?: Record<string, any>;
      trigger?: string;
    };
