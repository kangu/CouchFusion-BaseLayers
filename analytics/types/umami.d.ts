import type { UmamiClient } from "./umami";

declare module "#app" {
  interface NuxtApp {
    $analytics: UmamiClient;
    $umami: UmamiClient;
  }
}

declare module "nuxt/app" {
  interface NuxtApp {
    $analytics: UmamiClient;
    $umami: UmamiClient;
  }
}

declare module "vue" {
  interface ComponentCustomProperties {
    $analytics: UmamiClient;
    $umami: UmamiClient;
  }
}

export {};
