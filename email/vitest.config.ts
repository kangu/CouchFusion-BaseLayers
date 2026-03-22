import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["email/server/**/*.spec.ts"],
    globals: true,
  },
});
