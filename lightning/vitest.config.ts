import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const layer = (name: string) => fileURLToPath(new URL(`../${name}`, import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["./lightning/tests/**/*.spec.ts", "./lightning/tests/**/*.test.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "#auth": layer("auth"),
      "#database": layer("database"),
      "#email": layer("email"),
      "#lightning": layer("lightning"),
    },
  },
});
