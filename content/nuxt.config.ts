import { fileURLToPath } from "node:url";

export default defineNuxtConfig({
  alias: {
    "#content": fileURLToPath(new URL(".", import.meta.url)),
  },

  extends: ["../database"],

  modules: [
    fileURLToPath(new URL("./utils/ignored-prefixes.server", import.meta.url)),
    fileURLToPath(new URL("./utils/sitemap-routes.server", import.meta.url)),
    fileURLToPath(new URL("./utils/register-builder-page", import.meta.url)),
  ],

  imports: {
    dirs: [
      fileURLToPath(new URL("./app/composables", import.meta.url)),
      fileURLToPath(new URL("./app/stores", import.meta.url)),
    ],
  },

  plugins: [
    fileURLToPath(
      new URL(
        "./app/plugins/register-project-content-components",
        import.meta.url,
      ),
    ),
  ],

  components: {
    dirs: [
      /* global component import comes from the implementing app */
      {
        path: fileURLToPath(
          new URL("./app/components/builder", import.meta.url),
        ),
        // path: './components/builder',
        global: true,
        pathPrefix: false,
      },
      {
        path: fileURLToPath(
          new URL("./app/components/runtime", import.meta.url),
        ),
        // path: './components/runtime',
        global: true,
        pathPrefix: false,
      },
    ],
  },

  runtimeConfig: {
    public: {
      content: {},
    },
  },

  typescript: {
    strict: true,
  },

  hooks: {
    ready: async (nuxt) => {
      const runtimeConfig = nuxt.options.runtimeConfig;

      if (!runtimeConfig.dbLoginPrefix) {
        throw new Error(
          `
🚨 Content Layer Configuration Error:
The content layer requires 'dbLoginPrefix' to be configured in your app's runtimeConfig.

Add this to your nuxt.config.ts:
runtimeConfig: {
  dbLoginPrefix: 'your-prefix',
  // ... other config
}
                `.trim(),
        );
      }
    },
  },

  devtools: { enabled: true },
});
