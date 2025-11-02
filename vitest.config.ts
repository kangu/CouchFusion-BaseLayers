import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { loadEnv } from "vite";

console.log("[vitest] loading config from layers/vitest.config.ts");

const dirname = fileURLToPath(new URL(".", import.meta.url));
const resolveLayerPath = (relativePath: string) =>
  resolve(dirname, relativePath);
const contentRoot = resolveLayerPath("content");
const databaseRoot = resolveLayerPath("database");

const loadedEnv = loadEnv(process.env.NODE_ENV ?? "test", dirname, "");
for (const [key, value] of Object.entries(loadedEnv)) {
  process.env[key] = value;
}

export default defineConfig({
  root: "./",
  test: {
    environment: "node",
    setupFiles: ["./_tests/setup/content.ts"],
    include: ["content/tests/**/*.spec.ts", "content/tests/**/*.test.ts"],
    globals: true,
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
