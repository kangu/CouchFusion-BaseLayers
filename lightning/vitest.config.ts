import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["./lightning/tests/**/*.spec.ts", "./lightning/tests/**/*.test.ts"],
    globals: true,
  },
});
