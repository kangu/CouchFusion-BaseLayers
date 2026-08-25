import { fileURLToPath } from "node:url";

export default defineNuxtConfig({
  alias: {
    "#imagekit": fileURLToPath(new URL(".", import.meta.url)),
  },

  imports: {
    dirs: ["composables", "utils"],
  },

  plugins: [
    {
      src: fileURLToPath(
        new URL("./plugins/imagekit-directive", import.meta.url),
      ),
    },
    fileURLToPath(new URL("./plugins/lazy", import.meta.url)),
    fileURLToPath(new URL("./plugins/lazy-background", import.meta.url)),
  ],


  typescript: {
    strict: true,
  },

  devtools: {
    enabled: true,
  },
});
