import { fileURLToPath } from "node:url";
import { normalize } from "node:path";

export default defineNuxtConfig({
  alias: {
    "#content": fileURLToPath(new URL(".", import.meta.url)),
  },

  extends: ["../database"],

  modules: [
    fileURLToPath(new URL("./utils/ignored-prefixes.server", import.meta.url)),
    fileURLToPath(new URL("./utils/sitemap-routes.server", import.meta.url)),
    fileURLToPath(new URL("./utils/register-builder-page", import.meta.url)),
    fileURLToPath(new URL("./utils/component-registry-watch", import.meta.url)),
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
    fileURLToPath(
      new URL("./app/plugins/register-runtime-content-components", import.meta.url),
    ),
  ],

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
    "components:dirs": (dirs) => {
      const layerComponentsRoot = normalize(
        fileURLToPath(new URL("./app/components", import.meta.url)),
      );
      for (let index = 0; index < dirs.length; index += 1) {
        const entry = dirs[index];
        const entryObject =
          typeof entry === "string"
            ? { path: entry }
            : { ...entry };
        if (
          entryObject.path &&
          normalize(entryObject.path).startsWith(layerComponentsRoot)
        ) {
          entryObject.extensions = ["vue"];
          dirs[index] = entryObject;
        }
      }
    },
    "components:extend": (components) => {
      const runtimeDir = normalize(
        fileURLToPath(new URL("./app/components/runtime", import.meta.url)),
      );
      const builderDir = normalize(
        fileURLToPath(new URL("./app/components/builder", import.meta.url)),
      );
      for (let index = components.length - 1; index >= 0; index -= 1) {
        const filePath = normalize(components[index].filePath);
        if (
          filePath.startsWith(runtimeDir) ||
          filePath.startsWith(builderDir)
        ) {
          components.splice(index, 1);
        }
      }
    },
  },

  devtools: { enabled: true },
});
