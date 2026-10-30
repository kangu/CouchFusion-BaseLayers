import { fileURLToPath } from "node:url";

const layerDir = new URL(".", import.meta.url);

export default defineNuxtConfig({
  alias: {
    "#analytics": fileURLToPath(layerDir),
  },

  // Analytics data lives in CouchDB and optional engine settings are read from
  // the app's _config section, so this layer depends on the database layer's
  // #database alias -- declared the same way the lightning layer declares it.
  extends: ["../database"],

  imports: {
    dirs: [fileURLToPath(new URL("./composables", import.meta.url))],
  },

  // Registers /admin/analytics/** pages + nav only when
  // runtimeConfig.public.analytics.admin.enabled is true.
  modules: [fileURLToPath(new URL("./modules/admin", import.meta.url))],

  plugins: [
    fileURLToPath(new URL("./plugins/analytics.client", import.meta.url)),
    fileURLToPath(new URL("./plugins/analytics.server", import.meta.url)),
  ],

  runtimeConfig: {
    content: {
      ignore: ["/redir"],
    },
    public: {
      analytics: {
        endpoint: "/api/stats",
        // Self-hosted admin dashboard (requires the admin_workspace layer and
        // the `apexcharts` + `@iconify/vue` packages in the consuming app).
        admin: {
          enabled: false,
        },
        // Opt-in first-party persistent id (consent required). The server
        // still drops it unless CouchDB analytics_persistent_id=true.
        persistentId: false,
        // Opt-in auto-captured events: outbound-link-click, file-download.
        autoCapture: {
          outbound: false,
          downloads: false,
          downloadExtensions: "",
        },
        // Browser tracker payload options.
        includeTitle: true,
        sendReferrer: true,
        debug: false,
        // Optional tag attached to every hit (A/B variant, deploy, ...).
        tag: "",
        // Count hash-only route changes (/page#a -> /page#b) as pageviews.
        trackHashChanges: false,
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
