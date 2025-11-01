import { fileURLToPath } from "node:url";

export default defineNuxtConfig({
  // This layer provides shared database utilities and CouchDB functionality
  // Available to all layers and apps that extend this layer

  alias: {
    email: fileURLToPath(new URL(".", import.meta.url)),
  },
});
