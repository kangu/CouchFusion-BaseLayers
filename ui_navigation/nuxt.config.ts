import { fileURLToPath } from "node:url";

export default defineNuxtConfig({
  alias: {
    "#ui-navigation": fileURLToPath(new URL(".", import.meta.url)),
  },
  imports: {
    dirs: [fileURLToPath(new URL("./app/composables", import.meta.url))],
  },
});
