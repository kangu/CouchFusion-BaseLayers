import { fileURLToPath } from "node:url";

const layerDir = new URL(".", import.meta.url);

export default defineNuxtConfig({
  alias: {
    "#analytics": fileURLToPath(layerDir),
  },

  imports: {
    dirs: [fileURLToPath(new URL("./composables", import.meta.url))],
  },

  plugins: [
    fileURLToPath(new URL("./plugins/analytics.client", import.meta.url)),
    fileURLToPath(new URL("./plugins/analytics.server", import.meta.url)),
  ],

  runtimeConfig: {
    analytics: {
      umami: {
        proxyHost: "https://cloud.umami.is",
      },
    },
    public: {
      analytics: {
        endpoint: "/api/stats",
        umami: {
          websiteId: "",
          hostUrl: "/",
          scriptPath: "/script.js",
          dataDomains: "",
          autoTrack: true,
          excludedPaths: [] as string[] | string,
          includeTitle: true,
          sendReferrer: true,
          debug: false,
          appName: undefined as string | undefined,
        },
      },
    },
  },

  typescript: {
    strict: true,
  },

  devtools: {
    enabled: true,
  },
});
