import { fileURLToPath } from "node:url";

export default defineNuxtConfig({
  alias: {
    "#admin-workspace": fileURLToPath(new URL(".", import.meta.url)),
  },
  imports: {
    dirs: [fileURLToPath(new URL("./app/composables", import.meta.url))],
  },
});
