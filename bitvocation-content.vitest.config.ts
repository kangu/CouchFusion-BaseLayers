import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: resolve(dirname, ".."),
  plugins: [vue()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["apps/bitvocation/tests/**/*.spec.ts"],
  },
  resolve: {
    alias: {
      "~": resolve(dirname, "../apps/bitvocation/app"),
      "~~": resolve(dirname, "../apps/bitvocation"),
      "@": resolve(dirname, "../apps/bitvocation/app"),
      "#app": resolve(dirname, "../apps/bitvocation/tests/support/nuxt-app-stub.ts"),
      "#auth": resolve(dirname, "auth"),
      "#content": resolve(dirname, "content"),
      "#database": resolve(dirname, "database"),
      "#lightning": resolve(dirname, "lightning"),
      vue: resolve(
        dirname,
        "../apps/bitvocation/node_modules/vue/dist/vue.esm-bundler.js",
      ),
      "@iconify/vue": resolve(
        dirname,
        "../apps/bitvocation/node_modules/@iconify/vue/dist/iconify.js",
      ),
    },
  },
});
