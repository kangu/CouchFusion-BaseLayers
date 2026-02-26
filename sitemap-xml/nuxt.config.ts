import { fileURLToPath } from "node:url";

export default defineNuxtConfig({
    alias: {
        "#sitemap-xml": fileURLToPath(new URL(".", import.meta.url)),
    },
})
