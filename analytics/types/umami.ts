import type { Ref } from "vue";

export interface UmamiClient {
  isLoaded: Ref<boolean>;
  /**
   * Tracks a custom event with optional payload.
   */
  track: (event: string, data?: Record<string, any>) => void;
  /**
   * Tracks a page view. Without arguments it uses the current URL.
   */
  trackView: (url?: string, referrer?: string) => void;
  /**
   * Returns the underlying Umami global instance if available.
   */
  getInstance: () => any;
}

export type UmamiBindingValue =
  | string
  | {
      event: string;
      data?: Record<string, any>;
      trigger?: string;
    };
