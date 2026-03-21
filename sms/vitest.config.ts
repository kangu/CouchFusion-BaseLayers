import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["sms/server/**/*.spec.ts"],
    globals: true,
  },
  resolve: {
    alias: [
      { find: /^#database\/?$/, replacement: resolve(dirname, "../database") },
      { find: /^#database\/(.*)$/, replacement: resolve(dirname, "../database/$1") },
    ],
  },
});
