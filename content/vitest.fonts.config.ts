import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const dirname = fileURLToPath(new URL(".", import.meta.url));
const contentRoot = dirname;
const databaseRoot = resolve(dirname, "../database");

export default defineConfig({
  root: resolve(dirname, ".."),
  test: {
    environment: "node",
    globals: true,
    include: [
      "content/tests/server/font-assets.spec.ts",
      "content/tests/server/theme-settings.spec.ts",
    ],
  },
  resolve: {
    alias: [
      { find: /^#content\/?$/, replacement: contentRoot },
      { find: /^#content\/(.*)$/, replacement: `${contentRoot}/$1` },
      { find: /^#database\/?$/, replacement: databaseRoot },
      { find: /^#database\/(.*)$/, replacement: `${databaseRoot}/$1` },
    ],
  },
});
