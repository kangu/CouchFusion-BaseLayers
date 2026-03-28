import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const loginPagePath = resolve(repoRoot, "layers/auth/app/pages/login.vue");
const authNuxtConfigPath = resolve(repoRoot, "layers/auth/nuxt.config.ts");
const gasNuxtConfigPath = resolve(repoRoot, "apps/gas-maintenance/nuxt.config.ts");

describe("login heading configuration", () => {
  test("auth login page reads the heading from authLoginHeading runtime config", () => {
    const source = readFileSync(loginPagePath, "utf8");

    expect(source).toContain("runtimeConfig.public?.authLoginHeading");
    expect(source).not.toContain("<h1>CouchFusion Login</h1>");
  });

  test("auth layer exposes a default authLoginHeading config value", () => {
    const source = readFileSync(authNuxtConfigPath, "utf8");

    expect(source).toContain('authLoginHeading: "CouchFusion Login"');
  });

  test("gas-maintenance overrides the login heading to Gas Login", () => {
    const source = readFileSync(gasNuxtConfigPath, "utf8");

    expect(source).toContain('authLoginHeading: "Gas Login"');
  });
});
