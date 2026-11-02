import type { AnalyticsClient } from "./analytics";

declare module "#app" {
  interface NuxtApp {
    $analytics: AnalyticsClient;
  }
}

declare module "nuxt/app" {
  interface NuxtApp {
    $analytics: AnalyticsClient;
  }
}

declare module "vue" {
  interface ComponentCustomProperties {
    $analytics: AnalyticsClient;
  }
}

export {};
