import { describe, expect, test } from "bun:test";
import { resolveLoginRedirectTarget } from "./login-redirect";

describe("resolveLoginRedirectTarget", () => {
  test("uses redirectTo cookie value when present", () => {
    expect(
      resolveLoginRedirectTarget({
        redirectTo: "/admin/maintenance/clients",
        defaultTarget: "/admin",
      }),
    ).toBe("/admin/maintenance/clients");
  });

  test("falls back to configured default target when redirectTo is missing", () => {
    expect(
      resolveLoginRedirectTarget({
        redirectTo: null,
        defaultTarget: "/admin",
      }),
    ).toBe("/admin");
  });

  test("falls back to /builder when configured default target is blank", () => {
    expect(
      resolveLoginRedirectTarget({
        redirectTo: null,
        defaultTarget: "   ",
      }),
    ).toBe("/builder");
  });
});
