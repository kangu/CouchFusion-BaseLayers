import type { UmamiClient } from "./umami";

declare module "#app" {
  interface NuxtApp {
    $umami: UmamiClient;
  }
}

declare module "nuxt/app" {
  interface NuxtApp {
    $umami: UmamiClient;
  }
}

declare module "vue" {
  interface ComponentCustomProperties {
    $umami: UmamiClient;
  }
}

export {};
