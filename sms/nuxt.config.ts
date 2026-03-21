import { fileURLToPath } from "node:url";

export default defineNuxtConfig({
  alias: {
    "#sms": fileURLToPath(new URL(".", import.meta.url)),
  },
});
